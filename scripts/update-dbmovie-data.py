import os
import asyncio
import aiohttp
import json
import time
import sys

# --- 终端颜色配置 ---
GREEN, RED, YELLOW, BLUE, CYAN, BOLD, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[94m", "\033[96m", "\033[1m", "\033[0m"

TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
DATA_DIR = os.path.join(os.getcwd(), 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'dbmovie-data.json')
CONCURRENCY_LIMIT = 5 

REGIONS = [
    {"title": "全部", "limit": 300, "type": ""},
    {"title": "华语", "limit": 150, "type": "华语"},
    {"title": "欧美", "limit": 150, "type": "欧美"},
    {"title": "韩国", "limit": 150, "type": "韩国"},
    {"title": "日本", "limit": 150, "type": "日本"}
]

tmdb_cache = {}

class RateLimiter:
    def __init__(self, rate):
        self.rate, self.tokens, self.updated_at = rate, rate, time.monotonic()
    async def wait(self):
        while self.tokens < 1:
            now = time.monotonic()
            self.tokens += (now - self.updated_at) * self.rate
            self.updated_at = now
            if self.tokens < 1: await asyncio.sleep(0.1)
        self.tokens -= 1

limiter = RateLimiter(CONCURRENCY_LIMIT)

def parse_card_subtitle(subtitle):
    """从 '2025 / 中国大陆 / 剧情' 中提取年份"""
    if not subtitle: return None
    parts = subtitle.split('/')
    if len(parts) > 0:
        year_str = parts[0].strip()
        if year_str.isdigit() and len(year_str) == 4:
            return year_str
    return None

async def fetch_tmdb_detail(session, item):
    """标题+年份 严格匹配"""
    db_title = item.get('title', '').strip()
    db_year = parse_card_subtitle(item.get('card_subtitle', ''))
    
    cache_key = f"{db_title}_{db_year}"
    if cache_key in tmdb_cache: return tmdb_cache[cache_key], "命中缓存"

    await limiter.wait()
    # 电影用 /search/movie，如果是电视剧改用 /search/tv
    url = "https://api.themoviedb.org/3/search/movie"
    headers = {"Authorization": f"Bearer {TMDB_API_KEY}", "accept": "application/json"}
    params = {"query": db_title, "language": "zh-CN"}
    
    # 如果有年份，利用 primary_release_year 极大缩小搜索范围
    if db_year:
        params["primary_release_year"] = db_year

    try:
        async with session.get(url, params=params, headers=headers, timeout=10) as resp:
            if resp.status != 200: return None, f"TMDB接口错误({resp.status})"
            data = await resp.json()
            results = data.get("results", [])
            if not results: return None, f"TMDB未搜到(年份:{db_year or '无'})"

            matched_node = None
            for res in results:
                tmdb_title = res.get("title", "").strip().lower()
                tmdb_orig = res.get("original_title", "").strip().lower()
                search_name = db_title.lower()
                
                # 校验标题：中文名或原名必须一致
                is_title_match = (search_name == tmdb_title or search_name == tmdb_orig)
                
                # 校验年份：如果豆瓣有年份，TMDB的年份必须相同
                is_year_match = True
                if db_year and res.get("release_date"):
                    is_year_match = (res["release_date"][:4] == db_year)
                
                if is_title_match and is_year_match:
                    matched_node = res
                    break
            
            if not matched_node:
                return None, f"非精确匹配(拒绝: {results[0].get('title')})"

            info = {
                "id": str(matched_node["id"]),
                "type": "tmdb",
                "title": matched_node.get("title"),
                "description": matched_node.get("overview"),
                "posterPath": f"https://image.tmdb.org/t/p/w500{matched_node.get('poster_path')}" if matched_node.get('poster_path') else None,
                "rating": matched_node.get("vote_average"),
                "releaseDate": matched_node.get("release_date")
            }
            tmdb_cache[cache_key] = info
            return info, "匹配成功"
    except Exception as e:
        return None, str(e)

async def process_region(session, region):
    print(f"\n{BOLD}{BLUE}▶ 正在同步: {region['title']}{RESET}")
    url = "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie"
    headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", "Referer": "https://m.douban.com/movie/"}
    params = {"start": 0, "limit": region['limit'], "category": "", "type": region['type']}

    async with session.get(url, params=params, headers=headers) as resp:
        items = (await resp.json()).get("items", [])
        results = []
        tasks = [fetch_tmdb_detail(session, item) for item in items]
        
        done = 0
        for i, coro in enumerate(asyncio.as_completed(tasks)):
            res, reason = await coro
            done += 1
            movie_title = items[i-1].get('title', '未知')
            if res:
                results.append(res)
                print(f"   [{done}/{len(items)}] {GREEN}成功{RESET} | {movie_title}")
            else:
                print(f"   [{done}/{len(items)}] {RED}失败{RESET} | {movie_title} -> {reason}")
        return region['title'], results

async def main():
    if not TMDB_API_KEY: return
    os.makedirs(DATA_DIR, exist_ok=True)
    async with aiohttp.ClientSession() as session:
        final_data = {}
        for region in REGIONS:
            name, data = await process_region(session, region)
            final_data[name] = data
            await asyncio.sleep(1)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
    print(f"\n{BOLD}{GREEN}🎉 数据同步完成！{RESET}")

if __name__ == "__main__":
    asyncio.run(main())
