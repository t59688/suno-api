import requests
import json
import time

BASE_URL = "http://127.0.0.1:3000"


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
    }

    payload = {
        # 自定义歌词 / 文本
        "prompt": """
        [Intro - Music Box and Chimes]
*soft wind chimes*
(la la la~) [whispered, gentle]

[Verse 1]
小兔子跳进了星光森林
遇见了会唱歌的小星星
它们说啊说着魔法的语言
邀请她一起跳舞到天明

[Chorus - Bright and Cheerful]
闪呀闪，亮呀亮
森林里藏着小秘密
转呀转，跳呀跳
和月亮姐姐说悄悄话

[Verse 2]
树洞里住着彩虹色的小精灵
它们用露珠画出美丽的梦境
花朵们在夜晚轻轻歌唱
给勇敢的孩子们带来魔法糖

[Chorus - Bright and Cheerful]
闪呀闪，亮呀亮
森林里藏着小秘密
转呀转，跳呀跳
和月亮姐姐说悄悄话

[Bridge - Soft and Mysterious]
[Whispered vocals]
(嘘——听) *gentle bell*
风儿带来了什么消息？
(是谁在那里？) [echoed softly]
原来是梦想在开花结果

[Chorus - Building to Joy]
闪呀闪，亮呀亮
森林里藏着小秘密
转呀转，跳呀跳
和月亮姐姐说悄悄话

[Outro - Gentle Fade]
(la la la~) [soft, dreamy]
*music box melody*
[Fade out with chimes]
        """,
        # 音乐风格标签
        "tags": """A gentle female vocalist delivers a sweet, nurturing melody with a clear soprano range over a whimsical arrangement featuring glockenspiel, music box, and soft acoustic guitar arpeggios. The song is in a major key with a moderate tempo (andante range, 80-90 BPM), creating a playful yet soothing atmosphere. The vocal delivery is warm and expressive, with a storytelling quality that captures childlike wonder. Light orchestral strings provide harmonic support, while soft chimes and subtle harp glissandos add magical texture. There are gentle hand percussion elements (finger snaps, soft tambourine) that maintain a light, bouncing rhythm without overwhelming the delicate arrangement. The production is clean and spacious, with natural reverb that creates an intimate yet enchanted atmosphere.""",
        # 歌名
        "title": "星光森林的秘密",
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