from collections.abc import Callable

import requests
from loguru import logger

SuccessSpec = str | Callable[[dict], str]

REQUEST_TIMEOUT = 15
MAIN_API = 'https://api.bilibili.com'
LIVE_API = 'https://api.live.bilibili.com'
MANGA_API = 'https://manga.bilibili.com'
USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36'
)
CSRF_MISSING = "Bili_jct(csrf) 未找到"


def _live_sign_success(data: dict) -> str:
    return data.get('data', {}).get('text', '直播签到成功')


class BilibiliTask:
    def __init__(self, cookie: str):
        self.cookie = cookie
        self.headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.bilibili.com/',
            'Cookie': cookie,
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        self.csrf = self._get_csrf()

    def _get_csrf(self) -> str | None:
        for item in self.cookie.split(';'):
            key, sep, value = item.strip().partition('=')
            if sep and key == 'bili_jct':
                return value
        return None

    def _request_json(self, method: str, url: str, name: str = '',
                      silent: bool = False, **kwargs) -> tuple[dict | None, str | None]:
        try:
            res = self.session.request(method, url, timeout=REQUEST_TIMEOUT, **kwargs)
            res.raise_for_status()
            data = res.json()
        except (requests.RequestException, ValueError) as e:
            if not silent:
                logger.error(f"请求{name}API异常: {e}")
            return None, str(e)
        if not isinstance(data, dict):
            if not silent:
                logger.error(f"请求{name}API异常: 响应JSON格式异常")
            return None, '响应JSON格式异常'
        return data, None

    def _call(self, method: str, url: str, *, name: str = '', silent: bool = False,
              success: SuccessSpec = '成功', fail: str = '操作失败', **kwargs) -> tuple[bool, str]:
        data, err = self._request_json(method, url, name=name, silent=silent, **kwargs)
        if data and data.get('code') == 0:
            return True, success(data) if callable(success) else success
        if err:
            return False, err
        if not data:
            return False, fail
        return False, data.get('message', fail)

    def _csrf_call(self, method: str, url: str, success: SuccessSpec, fail: str,
                   **kwargs) -> tuple[bool, str]:
        if not self.csrf:
            return False, CSRF_MISSING
        return self._call(method, url, success=success, fail=fail, silent=True, **kwargs)

    def get_user_info(self) -> dict | None:
        data, _ = self._request_json('GET', f'{MAIN_API}/x/web-interface/nav', '用户信息')
        if data is None:
            return None
        if data.get('code') == 0:
            return data.get('data')
        logger.warning(f"获取用户信息失败: {data.get('message')}")
        return None

    def _bvids(self, url: str, name: str, key: str) -> list[str]:
        data, _ = self._request_json('GET', url, name)
        if not data or data.get('code') != 0:
            return []
        archives = data.get('data') or {}
        return [video['bvid'] for video in archives.get(key, [])
                if isinstance(video, dict) and video.get('bvid')]

    def get_dynamic_videos(self) -> list[str]:
        return self._bvids(f'{MAIN_API}/x/web-interface/dynamic/region?ps=5&rid=1',
                           '动态视频', 'archives')

    def get_ranking_videos(self) -> list[str]:
        return self._bvids(f'{MAIN_API}/x/web-interface/ranking/v2?rid=0&type=all',
                           '排行榜视频', 'list')

    def check_video_coin_status(self, bvid: str) -> bool:
        url = f'{MAIN_API}/x/web-interface/archive/coins?bvid={bvid}'
        data, _ = self._request_json('GET', url, silent=True)
        if data and data.get('code') == 0:
            return data.get('data', {}).get('multiply', 0) > 0
        return False

    def add_coin(self, bvid: str, num: int = 1, select_like: int = 1) -> tuple[bool, str]:
        return self._csrf_call(
            'POST',
            f'{MAIN_API}/x/web-interface/coin/add',
            '投币成功', '投币失败',
            data={'bvid': bvid, 'multiply': num, 'select_like': select_like, 'csrf': self.csrf},
        )

    def share_video(self, bvid: str) -> tuple[bool, str]:
        return self._csrf_call(
            'POST',
            f'{MAIN_API}/x/web-interface/share/add',
            '分享成功', '分享失败',
            data={'bvid': bvid, 'csrf': self.csrf},
        )

    def watch_video(self, bvid: str) -> tuple[bool, str]:
        return self._call(
            'POST',
            f'{MAIN_API}/x/click-interface/web/heartbeat',
            success='观看成功', fail='观看失败', silent=True,
            data={'bvid': bvid, 'played_time': 30, 'csrf': self.csrf},
        )

    def live_sign(self) -> tuple[bool, str]:
        return self._call(
            'GET',
            f'{LIVE_API}/xlive/web-ucenter/v1/sign/DoSign',
            success=_live_sign_success,
            fail='直播签到失败', silent=True,
        )

    def manga_sign(self) -> tuple[bool, str]:
        return self._call(
            'POST',
            f'{MANGA_API}/twirp/activity.v1.Activity/ClockIn',
            success='漫画签到成功', fail='漫画签到失败', silent=True,
            data={'platform': 'ios'},
        )
