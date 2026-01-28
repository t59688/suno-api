import requests
import json
import time

BASE_URL = "http://127.0.0.1:3100"
# TODO: 把这里替换成你在 suno.com/create 抓到的完整 Cookie 字符串（整条粘过来）
SUNO_COOKIE = (
    "__client=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdW5vLmNvbS9jbGFpbXMvY2xpZW50X2lkIjoiY2xpZW50X2pIV2dGVjM4bXh6UnRlRW1VRE1Xd2siLCJzdW5vLmNvbS9jbGFpbXMvdG9rZW5fdHlwZSI6InJlZnJlc2giLCJpc3MiOiJodHRwczovL2F1dGguc3Vuby5jb20iLCJleHAiOjE4MDExMzk5Mzh9.MIJoTQPyTQLPKmkqfqR1qcVvRt7ujh4OHYdjdIPHiCYfHqmNasVdvcjcVJlOlNt279xDNFGo2ZqVlXVMa549CHQV6bKZaI_b6Eq04eBaMVye77jR5XpS5Mh02Vb0BUY9nOYdxzY4gRjBD_8Xg5iD5VniBxwCNX6icBakSzFra8XV0W7UAQOuI8OO0-mrM9Ci7JXto6GG4AHzDnH2bC7Mb5TgOUWygMROYBV9KsWVk3gA8MNbsww2evB-Llh-3i2ZNF1GfW1Jipwo-oeoMVAXPE9F0s71SwjdqfUxkdWbjZSNFhZCaBTUVIr3T5TcWgX0ibkA2ap5sgnBDcIlSWYyrw; __client_Jnxw-muT=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdW5vLmNvbS9jbGFpbXMvY2xpZW50X2lkIjoiY2xpZW50X2pIV2dGVjM4bXh6UnRlRW1VRE1Xd2siLCJzdW5vLmNvbS9jbGFpbXMvdG9rZW5fdHlwZSI6InJlZnJlc2giLCJpc3MiOiJodHRwczovL2F1dGguc3Vuby5jb20iLCJleHAiOjE4MDExMzk5Mzh9.MIJoTQPyTQLPKmkqfqR1qcVvRt7ujh4OHYdjdIPHiCYfHqmNasVdvcjcVJlOlNt279xDNFGo2ZqVlXVMa549CHQV6bKZaI_b6Eq04eBaMVye77jR5XpS5Mh02Vb0BUY9nOYdxzY4gRjBD_8Xg5iD5VniBxwCNX6icBakSzFra8XV0W7UAQOuI8OO0-mrM9Ci7JXto6GG4AHzDnH2bC7Mb5TgOUWygMROYBV9KsWVk3gA8MNbsww2evB-Llh-3i2ZNF1GfW1Jipwo-oeoMVAXPE9F0s71SwjdqfUxkdWbjZSNFhZCaBTUVIr3T5TcWgX0ibkA2ap5sgnBDcIlSWYyrw; ab.storage.sessionId.b67099e5-3183-4de8-8f8f-fdea9ac93d15=g%3A5b85b8ea-fa81-49cc-87b0-d6eb0c405f68%7Ce%3A1769605747753%7Cc%3A1769603947753%7Cl%3A1769603947753; ab.storage.deviceId.b67099e5-3183-4de8-8f8f-fdea9ac93d15=g%3Ab102044e-6f60-4ef5-9198-53d8d05c094a%7Ce%3Aundefined%7Cc%3A1767973423451%7Cl%3A1769603947754; ab.storage.userId.b67099e5-3183-4de8-8f8f-fdea9ac93d15=g%3Aa07eea06-a552-4f99-a762-971862f93c0d%7Ce%3Aundefined%7Cc%3A1769603947752%7Cl%3A1769603947755; __stripe_sid=9c935976-d690-4937-9ff4-a011e8202f9c2c5914; _scid_r=mpYcb53Jh3cJCr9LRLy4NoAr2OL_5XKHD6TFmg; _ga_7B0KEDD7XP=GS2.1.s1769603914$o13$g1$t1769603984$j60$l0$h0$dA12SekR1Rv1knAVv1kSZaBLVqjyyG5yizg; ax_visitor=%7B%22firstVisitTs%22%3A1768307539958%2C%22lastVisitTs%22%3A1769435068474%2C%22currentVisitStartTs%22%3A1769603915805%2C%22ts%22%3A1769603984658%2C%22visitCount%22%3A8%7D; _sp_id.e685=4694ae23-15ac-4153-b763-82a046791aec.1768307552.9.1769603984.1769439785.a4bce2a0-ca79-495c-9683-34feea9a30dd.883d3b57-0281-4a75-acef-cceb2c338c6c.1ae89c7a-6511-4942-865f-ae7c56bf34fd.1769603926302.9; _uetsid=4513bc90fc4611f08037371135d94034|9qgscs|2|g33|0|2219; _uetvid=ce78f9e0e19e11f0a62937c38b501f36|1ifznki|1769603952926|6|1|bat.bing.com/p/conversions/c/y; tatari-session-cookie=86b92bad-7550-09e9-168a-60ee6619eef9; ttcsid_CT67HURC77UB52N3JFBG=1769603926294::mtwwx-HRm0NMooZ2MNpU.7.1769603985056.1; ttcsid=1769603926295::AugTXlru7Au8ApPjIMx-.7.1769603985056.0"
)

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