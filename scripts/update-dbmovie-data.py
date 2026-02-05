import os
import asyncio
import aiohttp
import json
import time
from datetime import datetime

# --- 配置 ---
TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
DATA_DIR = os.path.join(os.getcwd(), 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'dbmovie-data.json')
CONCURRENCY_LIMIT = 5  # 每秒最大请求数限制

# 缓存已匹配过的电影，避免跨区域重复查询
tmdb_cache = {}

class RateLimiter:
    """简单的令牌桶限流器"""
    def __init__(self, rate):
        self.rate = rate
        self.tokens = rate
        self.updated_at = time.monotonic()

    async def wait(self):
        while self.tokens < 1:
            now = time.monotonic()
            self.tokens += (now - self.updated_at) * self.rate
            self.updated_at = now
            if self.tokens < 1:
                await asyncio.sleep(0.1)
        self.tokens -= 1

limiter = RateLimiter(CONCURRENCY_LIMIT)

async def fetch_tmdb_detail(session, title):
    """异步获取 TMDB 详情，带缓存和重试逻辑"""
    if title in tmdb_cache:
        return tmdb_cache[title]

    await limiter.wait() # 频率控制
    url = "https://api.themoviedb.org/3/search/movie"
    params = {"api_key": TMDB_API_KEY, "query": title, "language": "zh-CN"}
    
    try:
        async with session.get(url, params=params, timeout=10) as resp:
            if resp.status == 429:
                retry_after = int(resp.headers.get("Retry-After", 1))
                await asyncio.sleep(retry_after)
                return await fetch_tmdb_detail(session, title)
            
            if resp.status == 200:
                data = await resp.json()
                results = data.get("results", [])
                if results:
                    matched = results[0]
                    res = {
                        "id": str(matched.get("id")),
                        "title": matched.get("title"),
                        "rating": matched.get("vote_average"),
                        "releaseDate": matched.get("release_date"),
                        "posterPath": f"https://image.tmdb.org/t/p/w500{matched.get('poster_path')}" if matched.get('poster_path') else None,
                    }
                    tmdb_cache[title] = res
                    return res
    except Exception as e:
        pass
    return None

async def process_region(session, region):
    """处理单个区域"""
    print(f"\033[36m▶ 正在处理区域: {region['title']}\033[0m")
    douban_url = "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie"
    headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", "Referer": "https://m.douban.com/movie/"}
    params = {"start": 0, "limit": region['limit'], "type": "" if region['title'] == "全部" else region['title']}

    try:
        async with session.get(douban_url, params=params, headers=headers) as resp:
            items = (await resp.json()).get("items", [])
            # 并发执行详情获取
            tasks = [fetch_tmdb_detail(session, item['title']) for item in items]
            results = await asyncio.gather(*tasks)
            matched = [r for r in results if r]
            print(f"   {region['title']} 完成: 匹配 {len(matched)}/{len(items)}")
            return region['title'], matched
    except Exception as e:
        print(f"   [Error] {region['title']} 失败: {e}")
        return region['title'], []

async def main():
    if not os.path.exists(DATA_DIR): os.makedirs(DATA_DIR)
    
    async with aiohttp.ClientSession() as session:
        regions = [
            {"title": "全部", "limit": 200},
            {"title": "华语", "limit": 100},
            {"title": "欧美", "limit": 100}
        ]
        
        final_data = {}
        for region in regions:
            name, data = await process_region(session, region)
            final_data[name] = data
            await asyncio.sleep(1) # 区域间稍微停顿

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
