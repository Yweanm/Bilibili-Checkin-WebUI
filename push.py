from datetime import datetime, timedelta, timezone

import requests
from loguru import logger

REQUEST_TIMEOUT = 15
PUSHPLUS_URL = "https://www.pushplus.plus/send"
BEIJING_TZ = timezone(timedelta(hours=8))
REPORT_TIME_FORMAT = '%Y-%m-%d %H:%M:%S'


def format_push_message(all_results):
    content = ["### Bilibili 任务报告\n"]

    for result in all_results:
        user_info = result.get('user_info')
        if user_info:
            content.append(f"--- \n#### 账号: {user_info['uname']} (Lv.{user_info['level_info']['current_level']})")
        else:
            content.append(f"--- \n#### 账号 {result['account_index']}")

        for name, (success, message) in result['tasks'].items():
            status_icon = "✅" if success else "❌"
            reason = f" - {message}" if message else ""
            content.append(f"- **{name}**: {status_icon}{reason}")

        if user_info:
            content.append(f"- **硬币余额**: {user_info['money']}")

    beijing_time = datetime.now(BEIJING_TZ).strftime(REPORT_TIME_FORMAT)
    content.append(f"\n> 报告时间: {beijing_time}")

    return "\n".join(content)


def send_to_pushplus(token, title, content):
    data = {"token": token, "title": title, "content": content, "template": "markdown"}
    try:
        res = requests.post(PUSHPLUS_URL, json=data, timeout=REQUEST_TIMEOUT)
        res_data = res.json()
    except (requests.RequestException, ValueError) as e:
        logger.error(f'PushPlus 推送异常: {e}')
        return
    if not isinstance(res_data, dict):
        logger.error('PushPlus 推送异常: 响应JSON格式异常')
        return
    if res_data.get('code') == 200:
        logger.info('PushPlus 推送成功！')
    else:
        logger.error(f'PushPlus 推送失败: {res_data.get("msg", "未知错误")}')
