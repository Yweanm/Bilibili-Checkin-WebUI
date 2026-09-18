import binascii
import importlib.util
import re
import time

import requests
from loguru import logger

_HAS_CRYPTO = importlib.util.find_spec("Crypto") is not None

RSA_PUBLIC_KEY_PEM = """\
-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDLgd2OAkcGVtoE3ThUREbio0Eg
Uc/prcajMKXvkCKFCWhJYJcLkcM2DKKcSeFpD/j6Boy538YXnR6VhcuUJOhH2x71
nzPjfdTcqMz7djHum0qSZA0AyCBDABUqCrfNgCiJ00Ra7GmRj+YCK1NJEuewlb40
JNrRuoEUXpabUzGB8QIDAQAB
-----END PUBLIC KEY-----"""

PASSPORT_API = "https://passport.bilibili.com"
CORRESPOND_URL = "https://www.bilibili.com/correspond/1/{path}"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36"
)
REQUEST_TIMEOUT = 15
REFRESHABLE_COOKIE_KEYS = ("SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid")

_refresh_csrf_re = re.compile(r'<div id="1-name">([^<]+)</div>')
_set_cookie_re = re.compile(
    "(" + "|".join(sorted(REFRESHABLE_COOKIE_KEYS, key=len, reverse=True)) + r")=([^;]+)"
)


def has_crypto() -> bool:
    return _HAS_CRYPTO


def parse_cookie(cookie_str: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in (cookie_str or "").split(";"):
        key, sep, value = item.strip().partition("=")
        if sep and key:
            result[key.strip()] = value.strip()
    return result


def build_cookie_str(original: str, updates: dict) -> str:
    merged = parse_cookie(original)
    for key in REFRESHABLE_COOKIE_KEYS:
        if updates.get(key):
            merged[key] = updates[key]
    parts: list[str] = []
    seen: set[str] = set()
    for item in (original or "").split(";"):
        key, sep, _ = item.strip().partition("=")
        if sep and key.strip() in merged and key.strip() not in seen:
            parts.append(f"{key.strip()}={merged[key.strip()]}")
            seen.add(key.strip())
    for key, value in merged.items():
        if key not in seen:
            parts.append(f"{key}={value}")
    return "; ".join(parts)


def get_correspond_path(timestamp_ms: int | None = None) -> str:
    if not _HAS_CRYPTO:
        raise RuntimeError("未安装 pycryptodome,无法生成 CorrespondPath")
    from Crypto.Cipher import PKCS1_OAEP
    from Crypto.Hash import SHA256
    from Crypto.PublicKey import RSA

    if timestamp_ms is None:
        timestamp_ms = round(time.time() * 1000)
    key = RSA.importKey(RSA_PUBLIC_KEY_PEM)
    cipher = PKCS1_OAEP.new(key, SHA256)
    encrypted = cipher.encrypt(f"refresh_{timestamp_ms}".encode())
    return binascii.b2a_hex(encrypted).decode()


def _headers(cookie_str: str) -> dict[str, str]:
    return {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.bilibili.com/",
        "Cookie": cookie_str,
    }


def check_need_refresh(cookie_str: str) -> tuple[bool | None, str]:
    """检查是否需要刷新。

    返回 (need: bool|None, detail: str):
      True  需要刷新; False 无需刷新; None 网络异常/无法判断(调用方应跳过刷新直接跑任务)。
    """
    cookies = parse_cookie(cookie_str)
    csrf = cookies.get("bili_jct", "")
    try:
        res = requests.get(
            f"{PASSPORT_API}/x/passport-login/web/cookie/info",
            params={"csrf": csrf},
            headers=_headers(cookie_str),
            timeout=REQUEST_TIMEOUT,
        )
        res.raise_for_status()
        data = res.json()
    except (requests.RequestException, ValueError) as e:
        return None, f"刷新检查请求异常,跳过刷新: {e}"
    if not isinstance(data, dict):
        return None, "刷新检查响应格式异常,跳过刷新"
    if data.get("code") == -101:
        return None, "账号未登录(-101),需手动重新获取 Cookie"
    if data.get("code") != 0:
        return None, f"刷新检查失败,跳过刷新: {data.get('message')}"
    need = bool(data.get("data", {}).get("refresh", False))
    return need, "需要刷新" if need else "无需刷新"


def get_refresh_csrf(cookie_str: str, correspond_path: str) -> tuple[str | None, str]:
    try:
        res = requests.get(
            CORRESPOND_URL.format(path=correspond_path),
            headers=_headers(cookie_str),
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as e:
        return None, f"获取 refresh_csrf 请求异常: {e}"
    if res.status_code == 404:
        return None, "CorrespondPath 过期或错误(404),可稍后重试,不要高频强刷"
    match = _refresh_csrf_re.search(res.text or "")
    if not match:
        return None, "获取刷新 Cookies 的 csrf 失败"
    return match.group(1), "ok"


def _extract_set_cookies(response) -> dict[str, str]:
    updates: dict[str, str] = {}
    try:
        for c in response.cookies:
            if c.name in REFRESHABLE_COOKIE_KEYS and c.value:
                updates[c.name] = c.value
    except (AttributeError, TypeError):
        pass
    try:
        raw_headers = response.raw.headers.getlist("Set-Cookie") if response.raw else []
    except (AttributeError, ValueError):
        raw_headers = []
    if not raw_headers and response.headers.get("Set-Cookie"):
        raw_headers = [response.headers.get("Set-Cookie")]
    for header in raw_headers:
        for m in _set_cookie_re.finditer(header or ""):
            if m.group(2):
                updates.setdefault(m.group(1), m.group(2))
    return updates


def refresh_cookie(cookie_str: str, refresh_token: str) -> tuple[str, str, bool, str]:
    if not refresh_token:
        return cookie_str, refresh_token, False, "未配置 refresh_token(ac_time_value),跳过刷新"
    if not _HAS_CRYPTO:
        return cookie_str, refresh_token, False, "未安装 pycryptodome,跳过刷新"
    cookies = parse_cookie(cookie_str)
    csrf = cookies.get("bili_jct")
    if not csrf or not cookies.get("SESSDATA"):
        return cookie_str, refresh_token, False, "Cookie 缺少 bili_jct/SESSDATA,需手动重登"

    correspond_path = get_correspond_path()
    refresh_csrf, msg = get_refresh_csrf(cookie_str, correspond_path)
    if not refresh_csrf:
        return cookie_str, refresh_token, False, msg

    old_refresh_token = refresh_token
    try:
        res = requests.post(
            f"{PASSPORT_API}/x/passport-login/web/cookie/refresh",
            data={
                "csrf": csrf,
                "refresh_csrf": refresh_csrf,
                "source": "main_web",
                "refresh_token": old_refresh_token,
            },
            headers=_headers(cookie_str),
            timeout=REQUEST_TIMEOUT,
        )
        res.raise_for_status()
        data = res.json()
    except (requests.RequestException, ValueError) as e:
        return cookie_str, refresh_token, False, f"刷新 Cookie 请求异常: {e}"

    if not isinstance(data, dict):
        return cookie_str, refresh_token, False, "刷新 Cookie 响应格式异常"
    code = data.get("code")
    if code == -101:
        return cookie_str, refresh_token, False, "账号未登录(-101),需手动重新获取 Cookie"
    if code == 86095:
        return cookie_str, refresh_token, False, "refresh_token 与 Cookie 不匹配(86095),需手动重登"
    if code != 0:
        return cookie_str, refresh_token, False, f"刷新 Cookie 失败: {data.get('message')}"

    updates = _extract_set_cookies(res)
    new_refresh_token = (data.get("data") or {}).get("refresh_token") or old_refresh_token
    if not updates.get("SESSDATA"):
        return cookie_str, refresh_token, False, "刷新接口未返回新 SESSDATA"
    new_cookie = build_cookie_str(cookie_str, updates)

    # 确认更新: 让旧 refresh_token 失效,必须用新 Cookie + 旧 token
    try:
        new_csrf = parse_cookie(new_cookie).get("bili_jct", "")
        confirm = requests.post(
            f"{PASSPORT_API}/x/passport-login/web/confirm/refresh",
            data={"csrf": new_csrf, "refresh_token": old_refresh_token},
            headers=_headers(new_cookie),
            timeout=REQUEST_TIMEOUT,
        )
        confirm_data = confirm.json() if confirm.content else {}
        if isinstance(confirm_data, dict) and confirm_data.get("code") not in (0, None):
            logger.warning(f"确认刷新接口返回异常(不影响新 Cookie 使用): {confirm_data.get('message')}")
    except (requests.RequestException, ValueError) as e:
        logger.warning(f"确认刷新请求异常(不影响新 Cookie 使用): {e}")

    return new_cookie, new_refresh_token, True, "Cookie 已自动刷新"


def ensure_refreshed(cookie_str: str, refresh_token: str) -> tuple[str, str, bool, str]:
    if not refresh_token:
        return cookie_str, refresh_token, False, "未配置 BILIBILI_REFRESH_TOKEN,跳过自动刷新(建议补充 ac_time_value)"
    need, detail = check_need_refresh(cookie_str)
    if need is not True:
        return cookie_str, refresh_token, False, detail
    return refresh_cookie(cookie_str, refresh_token)
