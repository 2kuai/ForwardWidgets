import asyncio
import aiohttp
import json
import time
import os

# --- 从环境变量读取令牌 ---
# 注意：如果你使用的是 Bearer Token，脚本会自动在 Header 中处理
TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
OUTPUT_FILE = "dbmovie-data.json"

DB_BASE_URL = "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie"

REGIONS = [
    {"title": "全部", "type": "", "limit": 50},
    {"title": "华语", "type": "华语", "limit": 40},
    {"title": "欧美", "type": "欧美", "limit": 40},
    {"title": "韩国", "type": "韩国", "limit": 30},
    {"title": "日本", "type": "日本", "limit": 30}
]

async def fetch_douban_list(session, region):
    params = {
        "start": 0,
        "limit": region["limit"],
        "type": region["type"]
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "Referer": "https://m.douban.com/movie/"
    }
    try:
        async with session.get(DB_BASE_URL, params=params, headers=headers) as resp:
            if resp.status != 200: return []
            data = await resp.json()
            return data.get("items", [])
    except Exception as e:
        print(f"   ❌ 豆瓣抓取失败: {e}")
        return []

async def fetch_tmdb_detail(session, item, cache):
    db_title = item.get("title", "").strip()
    subtitle = item.get("card_subtitle", "")
    # 提取年份逻辑: "2025 / 中国大陆 / ..."
    db_year = subtitle.split('/')[0].strip() if subtitle else None
    if db_year and not (db_year.isdigit() and len(db_year) == 4):
        db_year = None

    cache_key = f"{db_title}_{db_year}"
    if cache_key in cache: return cache[cache_key]

    url = "https://api.themoviedb.org/3/search/movie"
    
    # 自动识别令牌类型：如果是以 eyJ 开头的通常是 V4 Bearer Token
    headers = {"accept": "application/json"}
    params = {"query": db_title, "language": "zh-CN"}
    
    if TMDB_API_KEY.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {TMDB_API_KEY}"
    else:
        params["api_key"] = TMDB_API_KEY

    if db_year:
        params["primary_release_year"] = db_year

    try:
        async with session.get(url, params=params, headers=headers) as resp:
            if resp.status != 200: return None
            data = await resp.json()
            results = data.get("results", [])
            if not results: return None

            # 严格双重校验逻辑
            exact_match = None
            for res in results:
                tmdb_t = (res.get("title") or "").lower()
                tmdb_o = (res.get("original_title") or "").lower()
                target = db_title.lower()
                
                is_title_ok = (tmdb_t == target or tmdb_o == target)
                is_year_ok = True
                if db_year and res.get("release_date"):
                    is_year_ok = res["release_date"].startswith(db_year)
                
                if is_title_ok and is_year_ok:
                    exact_match = res
                    break

            if exact_match:
                info = {
                    "id": exact_match["id"],
                    "type": "tmdb",
                    "title": exact_match["title"],
                    "original_title": exact_match.get("original_title"),
                    "rating": exact_match.get("vote_average"),
                    "release_date": exact_match.get("release_date"),
                    "description": exact_match.get("overview"),
                    "poster_path": f"https://image.tmdb.org/t/p/w500{exact_match.get('poster_path')}" if exact_match.get('poster_path') else None,
                    "backdrop_path": f"https://image.tmdb.org/t/p/w500{exact_match.get('backdrop_path')}" if exact_match.get('backdrop_path') else None,
                    "genre_ids": exact_match.get("genre_ids")
                }
                cache[cache_key] = info
                return info
    except: pass
    return None

async def batch_process(session, items, size, cache):
    results = []
    for i in range(0, len(items), size):
        chunk = items[i:i + size]
        tasks = [fetch_tmdb_detail(session, item, cache) for item in chunk]
        chunk_results = await asyncio.gather(*tasks)
        results.extend([r for r in chunk_results if r is not None])
    return results

async def main():
    if not TMDB_API_KEY:
        print("❌ 错误: 未检测到环境变量 TMDB_API_KEY")
        return

    print("🚀 开始全量电影同步...")
    start_time = time.time()
    final_result = {}
    cache = {}

    async with aiohttp.ClientSession() as session:
        for region in REGIONS:
            print(f"📂 处理区域: [{region['title']}]")
            items = await fetch_douban_list(session, region)
            matched_data = await batch_process(session, items, 8, cache)
            final_result[region["title"]] = matched_data
            print(f"   ✅ 完成，匹配: {len(matched_data)}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_result, f, ensure_ascii=False, indent=2)

    print(f"\n📦 同步完成! 耗时: {round(time.time() - start_time, 1)}s")
    print(f"💾 数据已存入: {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
