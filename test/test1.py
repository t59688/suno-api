import requests
import json
import time

BASE_URL = "http://10.0.39.31:3100"
# TODO: 把这里替换成你在 suno.com/create 抓到的完整 Cookie 字符串（整条粘过来）
SUNO_COOKIE = (
    "__client=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdW5vLmNvbS9jbGFpbXMvY2xpZW50X2lkIjoiY2xpZW50X2pIV2dGVjM4bXh6UnRlRW1VRE1Xd2siLCJzdW5vLmNvbS9jbGFpbXMvdG9rZW5fdHlwZSI6InJlZnJlc2giLCJpc3MiOiJodHRwczovL2F1dGguc3Vuby5jb20iLCJleHAiOjE4MDExMzk5Mzh9.MIJoTQPyTQLPKmkqfqR1qcVvRt7ujh4OHYdjdIPHiCYfHqmNasVdvcjcVJlOlNt279xDNFGo2ZqVlXVMa549CHQV6bKZaI_b6Eq04eBaMVye77jR5XpS5Mh02Vb0BUY9nOYdxzY4gRjBD_8Xg5iD5VniBxwCNX6icBakSzFra8XV0W7UAQOuI8OO0-mrM9Ci7JXto6GG4AHzDnH2bC7Mb5TgOUWygMROYBV9KsWVk3gA8MNbsww2evB-Llh-3i2ZNF1GfW1Jipwo-oeoMVAXPE9F0s71SwjdqfUxkdWbjZSNFhZCaBTUVIr3T5TcWgX0ibkA2ap5sgnBDcIlSWYyrw; __client_Jnxw-muT=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdW5vLmNvbS9jbGFpbXMvY2xpZW50X2lkIjoiY2xpZW50X2pIV2dGVjM4bXh6UnRlRW1VRE1Xd2siLCJzdW5vLmNvbS9jbGFpbXMvdG9rZW5fdHlwZSI6InJlZnJlc2giLCJpc3MiOiJodHRwczovL2F1dGguc3Vuby5jb20iLCJleHAiOjE4MDExMzk5Mzh9.MIJoTQPyTQLPKmkqfqR1qcVvRt7ujh4OHYdjdIPHiCYfHqmNasVdvcjcVJlOlNt279xDNFGo2ZqVlXVMa549CHQV6bKZaI_b6Eq04eBaMVye77jR5XpS5Mh02Vb0BUY9nOYdxzY4gRjBD_8Xg5iD5VniBxwCNX6icBakSzFra8XV0W7UAQOuI8OO0-mrM9Ci7JXto6GG4AHzDnH2bC7Mb5TgOUWygMROYBV9KsWVk3gA8MNbsww2evB-Llh-3i2ZNF1GfW1Jipwo-oeoMVAXPE9F0s71SwjdqfUxkdWbjZSNFhZCaBTUVIr3T5TcWgX0ibkA2ap5sgnBDcIlSWYyrw; ab.storage.sessionId.b67099e5-3183-4de8-8f8f-fdea9ac93d15=g%3A5b85b8ea-fa81-49cc-87b0-d6eb0c405f68%7Ce%3A1769605747753%7Cc%3A1769603947753%7Cl%3A1769603947753; ab.storage.deviceId.b67099e5-3183-4de8-8f8f-fdea9ac93d15=g%3Ab102044e-6f60-4ef5-9198-53d8d05c094a%7Ce%3Aundefined%7Cc%3A1767973423451%7Cl%3A1769603947754; ab.storage.userId.b67099e5-3183-4de8-8f8f-fdea9ac93d15=g%3Aa07eea06-a552-4f99-a762-971862f93c0d%7Ce%3Aundefined%7Cc%3A1769603947752%7Cl%3A1769603947755; __stripe_sid=9c935976-d690-4937-9ff4-a011e8202f9c2c5914; _scid_r=mpYcb53Jh3cJCr9LRLy4NoAr2OL_5XKHD6TFmg; _ga_7B0KEDD7XP=GS2.1.s1769603914$o13$g1$t1769603984$j60$l0$h0$dA12SekR1Rv1knAVv1kSZaBLVqjyyG5yizg; ax_visitor=%7B%22firstVisitTs%22%3A1768307539958%2C%22lastVisitTs%22%3A1769435068474%2C%22currentVisitStartTs%22%3A1769603915805%2C%22ts%22%3A1769603984658%2C%22visitCount%22%3A8%7D; _sp_id.e685=4694ae23-15ac-4153-b763-82a046791aec.1768307552.9.1769603984.1769439785.a4bce2a0-ca79-495c-9683-34feea9a30dd.883d3b57-0281-4a75-acef-cceb2c338c6c.1ae89c7a-6511-4942-865f-ae7c56bf34fd.1769603926302.9; _uetsid=4513bc90fc4611f08037371135d94034|9qgscs|2|g33|0|2219; _uetvid=ce78f9e0e19e11f0a62937c38b501f36|1ifznki|1769603952926|6|1|bat.bing.com/p/conversions/c/y; tatari-session-cookie=86b92bad-7550-09e9-168a-60ee6619eef9; ttcsid_CT67HURC77UB52N3JFBG=1769603926294::mtwwx-HRm0NMooZ2MNpU.7.1769603985056.1; ttcsid=1769603926295::AugTXlru7Au8ApPjIMx-.7.1769603985056.0"
)


def poll_until_complete(clip_ids, max_wait_time=300, poll_interval=5):
    """
    轮询直到所有音频生成完成
    
    Args:
        clip_ids: 音频ID列表
        max_wait_time: 最大等待时间（秒），默认300秒
        poll_interval: 轮询间隔（秒），默认5秒
    
    Returns:
        完成后的音频信息列表，如果超时则返回最后的状态
    """
    url = f"{BASE_URL}/api/get"
    headers = {
        "Cookie": SUNO_COOKIE,
    }
    
    start_time = time.time()
    
    while time.time() - start_time < max_wait_time:
        # 查询音频状态
        ids_str = ",".join(clip_ids)
        try:
            resp = requests.get(f"{url}?ids={ids_str}", headers=headers, timeout=30)
        except Exception as e:
            print(f"❌ 查询失败: {e}")
            time.sleep(poll_interval)
            continue
        
        if resp.status_code != 200:
            print(f"❌ 查询失败: HTTP {resp.status_code}")
            time.sleep(poll_interval)
            continue
        
        clips = resp.json()
        
        # 检查所有音频的状态
        all_complete = True
        all_error = True
        
        print(f"\n⏰ 已等待 {int(time.time() - start_time)} 秒")
        for clip in clips:
            status = clip.get("status")
            clip_id = clip.get("id")
            title = clip.get("title", "未知")
            
            if status == "complete":
                print(f"✅ Clip {clip_id[:8]}... ({title}) - 生成完成")
            elif status == "streaming":
                print(f"⏳ Clip {clip_id[:8]}... ({title}) - 仍在生成中...")
                all_complete = False
                all_error = False
            elif status == "error":
                print(f"❌ Clip {clip_id[:8]}... ({title}) - 生成失败")
                all_complete = False
            else:
                print(f"⏳ Clip {clip_id[:8]}... ({title}) - 状态: {status}")
                all_complete = False
                all_error = False
        
        # 如果全部完成或全部失败，返回结果
        if all_complete:
            print("\n🎉 所有音频生成完成！")
            return clips
        elif all_error:
            print("\n❌ 所有音频生成失败")
            return clips
        
        # 等待后继续轮询
        time.sleep(poll_interval)
    
    # 超时，返回最后的状态
    print(f"\n⏰ 超时（{max_wait_time}秒），返回最后状态")
    return clips


def custom_generate_test():
    url = f"{BASE_URL}/api/custom_generate"

    headers = {
        "Content-Type": "application/json",
        # 关键：把 Suno 的 Cookie 通过 HTTP 头传给 suno-api
        "Cookie": SUNO_COOKIE,
    }

    payload = {
        # 自定义歌词 / 文本
        "prompt": """[Intro] [Glockenspiel and soft guitar]

[Verse 1] [Child voice, Curious and bright]
天上下来白白的
一片一片轻轻飘
伸出小手接一片
冰冰凉凉会融掉

[Chorus] [Playful, with cello warmth]
是面粉吗
从天空洒下来
是面粉吗
铺满整个世界
(Background: ding ding ding)
妈妈说这叫做雪
好美的雪

[Verse 2] [Child voice, Excited]
踩在上面咯吱咯吱响
留下小小脚印一双双
堆个雪人圆圆胖胖
给它围上红色的围巾长长

[Chorus] [Fuller, strings enter]
不是面粉啊
是雪花在飞舞
不是面粉啊
是冬天的礼物
(Background: ding ding ding)
原来这就是雪
好美的雪

[Bridge] [Instrumental, Glockenspiel solo with orchestral swell]
(Glockenspiel dances over strings)

[Verse 3] [Child voice, Tender and wondering]
第一次看到这样的白
第一次感觉这样的爱
世界变成童话的模样
我要记住这一天直到长大

[Chorus] [Full warmth, All elements]
这就是雪啊
像梦一样降落
这就是雪啊
我心里的快乐
(Background: ding ding ding)
我永远记得这雪
好美的雪

[Outro] [Fade, Glockenspiel and guitar]
面粉一样的雪
(Glockenspiel fades with soft triangle)""",
        # 音乐风格标签
        "tags": """A child vocalist with a clear, innocent soprano voice delivers playful and curious vocals. The song is in a major key, creating a joyful and whimsical mood. The tempo is moderate at around 100 BPM, with a gentle 3/4 waltz rhythm. A glockenspiel provides delicate, crystalline melodies that mimic falling snowflakes, accompanied by a soft acoustic guitar with fingerpicked arpeggios. A warm cello adds depth in the chorus, playing sustained notes that evoke wonder and tenderness. Light percussion enters subtly with brushed snare and soft triangle hits. The production is clean and spacious, with natural reverb creating an intimate, magical atmosphere. Strings swell gently in the bridge, adding orchestral warmth. The song structure follows a verse-chorus pattern with a brief instrumental interlude. The overall mood is enchanting and innocent, reminiscent of children's music with influences from contemporary classical and folk traditions.""",
        # 歌名
        "title": "Python Suno Custom Test",
        # 是否纯伴奏
        "make_instrumental": False,
        # 是否等待音频生成完成（服务端会帮你轮询 Suno 状态）
        # 注意：即使设置为 True，如果超时（100秒），服务端可能返回 streaming 状态
        "wait_audio": True,
        # model 不传则在服务端会默认用 chirp-crow（v5），也可以手动指定：
        "model": "chirp-auk-turbo",
    }

    print("📤 发送 custom_generate 请求...")
    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=300)

    print(f"HTTP 状态码: {resp.status_code}")
    try:
        data = resp.json()
    except Exception:
        print("返回内容不是 JSON：")
        print(resp.text)
        return

    print("\n原始返回：")
    print(json.dumps(data, indent=2, ensure_ascii=False))

    if not isinstance(data, list) or len(data) == 0:
        print("\n返回不是期望的列表结构，可能是错误信息。")
        return

    print("\n解析结果：")
    for i, item in enumerate(data):
        print(f"=== Clip #{i} ===")
        print("id:", item.get("id"))
        print("title:", item.get("title"))
        status = item.get("status")
        print("status:", status)
        print("audio_url:", item.get("audio_url"))
        print("video_url:", item.get("video_url"))
        
        # 检查状态，判断是否需要客户端轮询
        if status == "complete":
            print("✅ 状态：已完成，可以直接使用")
        elif status == "streaming":
            print("⚠️  状态：仍在生成中，需要继续轮询")
        elif status == "error":
            print("❌ 状态：生成失败")
        else:
            print(f"⏳ 状态：{status}，需要继续轮询")

    # 检查是否有未完成的音频，如果有则进行客户端轮询
    incomplete_clips = [clip for clip in data if clip.get("status") not in ["complete", "error"]]
    
    if incomplete_clips:
        print(f"\n⚠️  发现 {len(incomplete_clips)} 个未完成的音频，开始客户端轮询...")
        clip_ids = [clip["id"] for clip in data]
        completed_clips = poll_until_complete(clip_ids)
        
        print("\n📊 最终结果：")
        for clip in completed_clips:
            status = clip.get("status")
            title = clip.get("title", "未知")
            clip_id = clip.get("id")
            
            if status == "complete":
                print(f"✅ {title} ({clip_id[:8]}...)")
                print(f"   音频URL: {clip.get('audio_url')}")
                print(f"   视频URL: {clip.get('video_url') or '无'}")
            else:
                print(f"⚠️ {title} ({clip_id[:8]}...) - 状态: {status}")
    else:
        print("\n✅ 所有音频已完成，无需轮询")


if __name__ == "__main__":
    custom_generate_test()