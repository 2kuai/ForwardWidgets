import json
import requests
from datetime import datetime
import concurrent.futures

def check_url_availability(url, timeout=5):
    """
    检测单个URL的可用性
    """
    try:
        # 对于m3u8文件，只需要检查HEAD请求即可
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        if response.status_code == 200:
            return True
        # 有些服务器可能不支持HEAD请求，尝试GET
        response = requests.get(url, timeout=timeout, stream=True)
        return response.status_code == 200
    except:
        return False

def process_channel(channel):
    """
    处理单个频道的childItems
    """
    if 'childItems' not in channel or not channel['childItems']:
        return channel
    
    # 使用线程池并行检测所有childItems
    with concurrent.futures.ThreadPoolExecutor() as executor:
        urls = channel['childItems']
        results = list(executor.map(check_url_availability, urls))
    
    # 保留可用的链接
    channel['childItems'] = [url for url, is_available in zip(urls, results) if is_available]
    return channel

def main(input_file, output_file):
    # 读取输入文件
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 更新最后修改时间
    data['last_updated'] = datetime.now().strftime('%Y-%m-%d')
    
    # 处理所有频道
    for category in ['cctv', 'stv', 'ltv']:
        if category in data:
            data[category] = [process_channel(channel) for channel in data[category]]
    
    # 保存结果
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"检测完成，结果已保存到 {output_file}")

if __name__ == '__main__':
    input_file = 'iptv_sources.json'
    output_file = 'iptv_sources_cleaned.json'
    main(input_file, output_file)
