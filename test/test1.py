import requests
import json
import time

BASE_URL = "http://127.0.0.1:3100"
# TODO: 把这里替换成你在 suno.com/create 抓到的完整 Cookie 字符串（整条粘过来）
SUNO_COOKIE = ("111")

def custom_generate_test():
    url = f"{BASE_URL}/api/custom_generate"

    headers = {
        "Content-Type": "application/json",
        # 关键：把 Suno 的 Cookie 通过 HTTP 头传给 suno-api
        "Cookie": SUNO_COOKIE,
    }

    payload = {
        # 自定义歌词 / 文本
        "prompt": "[Verse]\nThis is a test song\n[Chorus]\nPython calling Suno API",
        # 音乐风格标签
        "tags": "rock, energetic, electric guitar",
        # 歌名
        "title": "Python Suno Custom Test",
        # 是否纯伴奏
        "make_instrumental": False,
        # 是否等待音频生成完成（服务端会帮你轮询 Suno 状态）
        "wait_audio": True,
        # model 不传则在服务端会默认用 chirp-crow（v5），也可以手动指定：
        "model": "chirp-auk-turbo",
    }

    print("发送 custom_generate 请求...")
    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=300)

    print("HTTP 状态码:", resp.status_code)
    try:
        data = resp.json()
    except Exception:
        print("返回内容不是 JSON：")
        print(resp.text)
        return

    print("原始返回：")
    print(json.dumps(data, indent=2, ensure_ascii=False))

    if isinstance(data, list) and len(data) > 0:
        print("\n解析结果：")
        for i, item in enumerate(data):
            print(f"=== Clip #{i} ===")
            print("id:", item.get("id"))
            print("title:", item.get("title"))
            print("status:", item.get("status"))
            print("audio_url:", item.get("audio_url"))
            print("video_url:", item.get("video_url"))
    else:
        print("\n返回不是期望的列表结构，可能是错误信息。")

if __name__ == "__main__":
    custom_generate_test()
