import os
import sys
from datetime import datetime, timedelta, timezone

import requests
from loguru import logger

from bilibili import BilibiliTask
from cookie_refresh import ensure_refreshed
from push import format_push_message, send_to_pushplus

DEFAULT_TASKS = ['live_sign', 'manga_sign', 'share_video', 'add_coin']
DEFAULT_TASK_CONFIG = ','.join(DEFAULT_TASKS)
DEFAULT_COIN_ADD_NUM = '1'
DEFAULT_COIN_SELECT_LIKE = '1'
DEFAULT_COIN_VIDEO_SOURCE = 'dynamic'
FALLBACK_BVID = 'BV1GJ411x7h7'

IGNORE_FAIL_KEYWORDS = ("未配置", "跳过", "已下线")
REFRESH_SKIP_KEYWORDS = ("刷新", "Cookie", "refresh", "ac_time_value", "pycryptodome")
COIN_DAILY_LIMIT = 5
SEPARATOR = '-' * 40
BEIJING_OFFSET = timedelta(hours=8)


class BeijingFormatter:
    @staticmethod
    def format(record):
        dt = datetime.fromtimestamp(record["time"].timestamp(), tz=timezone.utc)
        local_dt = dt + BEIJING_OFFSET
        record["extra"]["local_time"] = local_dt.strftime('%H:%M:%S,%f')[:-3]
        return "{time:YYYY-MM-DD HH:mm:ss,SSS}(CST {extra[local_time]}) - {level} - {message}\n"


logger.remove()
logger.add(sys.stdout, format=BeijingFormatter.format, level="INFO", colorize=True)


def mask_string(s) -> str:
    if not isinstance(s, str) or len(s) == 0:
        return '*'
    return s[0] + '*' * (len(s) - 1)


def mask_uid(uid) -> str:
    uid_str = str(uid)
    if len(uid_str) <= 2:
        return uid_str[0] + '*'
    return uid_str[:2] + '*' * (len(uid_str) - 2)


def safe_int(value, default=0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def execute_coin_task(bili, user_info, config):
    coins_to_add = safe_int(config.get('COIN_ADD_NUM'), 1)
    if coins_to_add <= 0:
        return True, "配置为0，跳过"

    coin_balance = safe_int(user_info.get('money', 0))
    if coin_balance < 1:
        return True, f"硬币不足({coin_balance})，跳过"

    coins_to_add = min(coins_to_add, coin_balance, COIN_DAILY_LIMIT)

    if config.get('COIN_VIDEO_SOURCE') == 'ranking':
        video_list = bili.get_ranking_videos()
        logger.info("获取排行榜视频作为投币目标。")
    else:
        video_list = bili.get_dynamic_videos()
        logger.info("获取动态视频作为投币目标。")

    if not video_list:
        return False, "无法获取视频列表"

    added_coins = 0
    for bvid in video_list:
        if added_coins >= coins_to_add:
            break

        success, msg = bili.add_coin(bvid, 1, safe_int(config.get('COIN_SELECT_LIKE'), 1))
        if success:
            added_coins += 1
            logger.info(f"为视频 {bvid} 投币成功。")
        elif "已达到" in msg:
            logger.warning("今日投币上限已满，终止投币。")
            added_coins = coins_to_add
            break
        else:
            logger.warning(f"为视频 {bvid} 投币失败: {msg}")
            if "硬币不足" in msg:
                break

    return True, f"尝试投币，最终成功 {added_coins} 枚"


def run_all_tasks_for_account(bili, config):
    tasks_to_run = [task.strip() for task in config.get('TASK_CONFIG', '').split(',') if task.strip()]
    if not tasks_to_run:
        tasks_to_run = DEFAULT_TASKS

    user_info = bili.get_user_info()
    if not user_info:
        return {'登录检查': (False, 'Cookie失效或网络问题')}, None

    logger.info(f"账号名称: {mask_string(user_info.get('uname'))}")

    video_list = bili.get_dynamic_videos()
    bvid = video_list[0] if video_list else FALLBACK_BVID

    tasks_result = {}
    if 'share_video' in tasks_to_run:
        tasks_result['分享视频'] = bili.share_video(bvid)
    if 'live_sign' in tasks_to_run:
        tasks_result['直播签到'] = bili.live_sign()
    if 'manga_sign' in tasks_to_run:
        tasks_result['漫画签到'] = bili.manga_sign()
    if 'add_coin' in tasks_to_run:
        tasks_result['投币任务'] = execute_coin_task(bili, user_info, config)

    tasks_result['观看视频'] = bili.watch_video(bvid)

    return tasks_result, user_info


def _log_account_tasks(account_index, tasks_result):
    valid_task_count = 0
    valid_success_count = 0

    for task_name, (success, msg) in tasks_result.items():
        if "push" in task_name or "推送" in task_name:
            continue
        if any(k in task_name for k in REFRESH_SKIP_KEYWORDS):
            if success:
                logger.info(f"[账号{account_index}] {task_name}: {msg}")
            else:
                logger.warning(f"[账号{account_index}] {task_name}: {msg}")
            continue
        if msg and any(k in msg for k in IGNORE_FAIL_KEYWORDS):
            logger.info(f"[账号{account_index}] {task_name}: 跳过，原因: {msg}")
            continue
        valid_task_count += 1
        if success:
            valid_success_count += 1
            logger.info(f"[账号{account_index}] {task_name}: 成功")
        else:
            logger.error(f"[账号{account_index}] {task_name}: 失败，原因: {msg}")

    return valid_task_count, valid_success_count


def _log_account_user(account_index, user_info):
    logger.info(f"=== 账号{account_index} 用户信息 ===")
    if not user_info:
        logger.error("用户信息获取失败")
        return
    level_info = user_info.get('level_info', {})
    logger.info(f"用户名: {mask_string(user_info.get('uname'))}")
    logger.info(f"UID: {mask_uid(user_info.get('mid'))}")
    logger.info(f"等级: {level_info.get('current_level')}")
    logger.info(f"经验: {level_info.get('current_exp')}")
    logger.info(f"硬币: {user_info.get('money')}")


def split_multi(value) -> list:
    if not value:
        return []
    return [c.strip() for c in value.split('###')]


def write_github_outputs(cookie_new: str, refresh_new: str):
    """供 workflow gh CLI 回写 Secrets: 输出到 $GITHUB_OUTPUT。"""
    output_file = os.environ.get("GITHUB_OUTPUT")
    if not output_file:
        return
    try:
        with open(output_file, "a", encoding="utf-8") as f:
            f.write(f"BILIBILI_COOKIE_NEW={cookie_new}\n")
            f.write(f"BILIBILI_REFRESH_TOKEN_NEW={refresh_new}\n")
            f.write("COOKIE_REFRESHED=true\n")
    except OSError as e:
        logger.warning(f"写入 GITHUB_OUTPUT 失败(不影响任务): {e}")


def run_all_accounts(config):
    cookies = split_multi(config["BILIBILI_COOKIE"])
    cookies = [c for c in cookies if c]
    refresh_tokens = split_multi(config.get("BILIBILI_REFRESH_TOKEN"))
    while len(refresh_tokens) < len(cookies):
        refresh_tokens.append("")
    logger.info(f"检测到 {len(cookies)} 个账号，开始执行任务...")

    all_results = []
    any_failed = False
    any_refreshed = False
    for i, cookie in enumerate(cookies, 1):
        logger.info(f"=== 账号{i} 任务完成情况 ===")
        refresh_token = refresh_tokens[i - 1] if i - 1 < len(refresh_tokens) else ""
        try:
            new_cookie, new_token, refreshed, refresh_msg = ensure_refreshed(cookie, refresh_token)
        except (RuntimeError, requests.RequestException, ValueError) as e:
            new_cookie, new_token, refreshed, refresh_msg = cookie, refresh_token, False, f"自动刷新异常,跳过刷新: {e}"
        if refreshed:
            any_refreshed = True
            cookies[i - 1] = new_cookie
            refresh_tokens[i - 1] = new_token
            logger.info(f"[账号{i}] Cookie 已自动刷新,新 Cookie 将用于本次任务。")
        else:
            logger.info(f"[账号{i}] Cookie刷新检查: {refresh_msg}")

        bili = BilibiliTask(new_cookie)
        tasks_result, user_info = run_all_tasks_for_account(bili, config)
        tasks_result = {"Cookie刷新": (refreshed or "跳过" in refresh_msg or "无需" in refresh_msg, refresh_msg), **tasks_result}
        final_user_info = bili.get_user_info() if user_info else None
        all_results.append({'account_index': i, 'tasks': tasks_result, 'user_info': final_user_info})

        valid_task_count, valid_success_count = _log_account_tasks(i, tasks_result)

        if not user_info or valid_task_count == 0 or valid_success_count == 0:
            any_failed = True

        masked_name = mask_string(final_user_info.get('uname')) if final_user_info else f'账号{i}'
        _log_account_user(i, final_user_info)
        logger.info(f"--- 账号 {masked_name} 任务执行完毕 ---")
        logger.info(SEPARATOR)

    if any_refreshed:
        cookie_new = "###".join(cookies)
        refresh_new = "###".join(refresh_tokens)
        write_github_outputs(cookie_new, refresh_new)
        logger.info("检测到 Cookie 已刷新: Actions 将自动回写 Secrets(需配置 COOKIE_REFRESH_PAT),本地运行请手动更新 Secrets。")
    return all_results, any_failed


def main():
    config = {
        "BILIBILI_COOKIE": os.environ.get('BILIBILI_COOKIE'),
        "BILIBILI_REFRESH_TOKEN": os.environ.get('BILIBILI_REFRESH_TOKEN'),
        "PUSH_PLUS_TOKEN": os.environ.get('PUSH_PLUS_TOKEN'),
        "TASK_CONFIG": os.environ.get('TASK_CONFIG') or DEFAULT_TASK_CONFIG,
        "COIN_ADD_NUM": os.environ.get('COIN_ADD_NUM') or DEFAULT_COIN_ADD_NUM,
        "COIN_SELECT_LIKE": os.environ.get('COIN_SELECT_LIKE') or DEFAULT_COIN_SELECT_LIKE,
        "COIN_VIDEO_SOURCE": os.environ.get('COIN_VIDEO_SOURCE') or DEFAULT_COIN_VIDEO_SOURCE,
    }

    if not config["BILIBILI_COOKIE"]:
        logger.error('环境变量 BILIBILI_COOKIE 未设置，程序终止')
        sys.exit(1)

    all_results, any_failed = run_all_accounts(config)

    if config["PUSH_PLUS_TOKEN"] and all_results:
        logger.info('准备发送推送通知...')
        send_to_pushplus(config["PUSH_PLUS_TOKEN"], "Bilibili 任务通知", format_push_message(all_results))
    else:
        logger.info('未配置 PUSH_PLUS_TOKEN，跳过推送。')

    if any_failed:
        logger.error("有账号任务失败，整个任务失败！")
        sys.exit(1)
    logger.info("所有账号任务全部成功！")
    sys.exit(0)


if __name__ == '__main__':
    main()
