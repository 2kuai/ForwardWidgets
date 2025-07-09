import json
import requests
from datetime import datetime
import concurrent.futures

def check_url_availability(url, timeout=5):
    """检测单个URL的可用性和响应时间"""
    try:
        # 先尝试HEAD请求，效率更高
        start_time = datetime.now()
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        latency = (datetime.now() - start_time).total_seconds() * 1000  # 毫秒
        
        if response.status_code == 200:
            return True, latency
        
        # 如果HEAD失败，尝试GET请求
        start_time = datetime.now()
        response = requests.get(url, timeout=timeout, stream=True)
        latency = (datetime.now() - start_time).total_seconds() * 1000  # 毫秒
        return response.status_code == 200, latency
    except:
        return False, float('inf')  # 不可用的URL给无限大的延迟

def process_channel(channel):
    """处理单个频道的childItems，并按响应时间排序"""
    if 'childItems' not in channel or not channel['childItems']:
        return channel
    
    # 使用线程池并行检测所有childItems
    with concurrent.futures.ThreadPoolExecutor() as executor:
        urls = channel['childItems']
        # 获取每个URL的可用性和延迟
        results = list(executor.map(check_url_availability, urls))
    
    # 组合URL和检测结果
    url_info = list(zip(urls, results))
    
    # 过滤掉不可用的URL，并按延迟排序
    available_urls = [(url, latency) for url, (is_available, latency) in url_info if is_available]
    
    # 检查是否已经按延迟排序
    is_sorted = True
    for i in range(len(available_urls) - 1):
        if available_urls[i][1] > available_urls[i+1][1]:
            is_sorted = False
            break
    
    # 如果未排序，则按延迟排序
    if not is_sorted and len(available_urls) > 1:
        available_urls.sort(key=lambda x: x[1])
    
    # 只保留URL，去掉延迟数据
    channel['childItems'] = [url for url, _ in available_urls]
    return channel

def main(input_file, output_file):
    """主函数"""
    # 读取输入文件
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 更新最后修改时间
    data['last_updated'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 处理所有频道
    for category in data:
        if isinstance(data[category], list):  # 只处理列表类型的频道
            data[category] = [process_channel(channel) for channel in data[category]]
    
    # 保存结果
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"检测完成，结果已保存到 {output_file}")

if __name__ == '__main__':
    input_file = 'iptv_sources.json'
    output_file = 'data/iptv-data.json'
    main(input_file, output_file)
