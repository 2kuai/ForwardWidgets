import json
import requests
import subprocess
from datetime import datetime
import concurrent.futures
import os
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('iptv_checker.log')
    ]
)
logger = logging.getLogger(__name__)

def check_url_with_head(url, timeout=5):
    """使用HEAD请求检测URL的初步可用性"""
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        if response.status_code == 200:
            logger.info(f"HEAD请求成功: {url}")
            return True
        else:
            logger.warning(f"HEAD请求返回非200状态码({response.status_code}): {url}")
            return False
    except Exception as e:
        logger.error(f"HEAD请求失败({str(e)}): {url}")
        return False

def check_url_with_ffmpeg(url, timeout=10):
    """使用ffmpeg检测流媒体的实际可用性"""
    try:
        # 使用ffmpeg探测流媒体，设置超时时间
        cmd = [
            'ffmpeg',
            '-v', 'error',
            '-i', url,
            '-map', '0',
            '-f', 'null',
            '-',
            '-t', str(timeout)  # 限制探测时间
        ]
        
        # 启动ffmpeg进程
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE
        )
        
        # 等待进程完成或超时
        try:
            _, stderr = process.communicate(timeout=timeout)
            if process.returncode == 0 and b"Invalid data found" not in stderr:
                logger.info(f"FFmpeg检测成功: {url}")
                return True
            else:
                logger.warning(f"FFmpeg检测失败(返回码:{process.returncode}): {url}")
                return False
        except subprocess.TimeoutExpired:
            process.kill()
            logger.warning(f"FFmpeg检测超时: {url}")
            return False
    except Exception as e:
        logger.error(f"FFmpeg检测异常({str(e)}): {url}")
        return False

def check_url_availability(url, timeout=5):
    """检测单个URL的可用性和响应时间"""
    # 先使用HEAD请求快速筛选
    if not check_url_with_head(url, timeout):
        return False, float('inf')
    
    # 使用ffmpeg进行更严格的检测
    start_time = datetime.now()
    is_available = check_url_with_ffmpeg(url, timeout)
    latency = (datetime.now() - start_time).total_seconds() * 1000  # 毫秒
    
    if is_available:
        logger.info(f"URL检测完成: {url} 延迟: {latency:.2f}ms")
    else:
        logger.warning(f"URL不可用: {url}")
    
    return is_available, latency

def process_channel(channel):
    """处理单个频道的childItems，并按响应时间排序"""
    if 'childItems' not in channel or not channel['childItems']:
        logger.warning(f"频道 {channel.get('name', '未知')} 没有childItems")
        return channel
    
    logger.info(f"开始处理频道: {channel.get('name', '未知')}")
    
    # 使用线程池并行检测所有childItems
    with concurrent.futures.ThreadPoolExecutor() as executor:
        urls = channel['childItems']
        # 获取每个URL的可用性和延迟
        results = list(executor.map(check_url_availability, urls))
    
    # 组合URL和检测结果
    url_info = list(zip(urls, results))
    
    # 过滤掉不可用的URL，并按延迟排序
    available_urls = [(url, latency) for url, (is_available, latency) in url_info if is_available]
    
    # 记录检测结果
    logger.info(f"频道 {channel.get('name', '未知')} 检测结果: 共 {len(urls)} 个源, 可用 {len(available_urls)} 个")
    
    # 检查是否已经按延迟排序
    is_sorted = True
    for i in range(len(available_urls) - 1):
        if available_urls[i][1] > available_urls[i+1][1]:
            is_sorted = False
            break
    
    # 如果未排序，则按延迟排序
    if not is_sorted and len(available_urls) > 1:
        available_urls.sort(key=lambda x: x[1])
        logger.info(f"频道 {channel.get('name', '未知')} 已按延迟排序")
    
    # 只保留URL，去掉延迟数据
    channel['childItems'] = [url for url, _ in available_urls]
    return channel

def main(input_file, output_file):
    """主函数"""
    logger.info("开始IPTV源检测")
    
    # 检查ffmpeg是否可用
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        logger.info("FFmpeg检测通过")
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.error("错误: ffmpeg未安装或不可用，请先安装ffmpeg")
        return
    
    # 读取输入文件
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        logger.info(f"成功读取输入文件: {input_file}")
    except Exception as e:
        logger.error(f"读取输入文件失败: {str(e)}")
        return
    
    # 更新最后修改时间
    data['last_updated'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    logger.info(f"更新时间设置为: {data['last_updated']}")
    
    # 处理所有频道
    for category in data:
        if isinstance(data[category], list):  # 只处理列表类型的频道
            logger.info(f"开始处理分类: {category}")
            data[category] = [process_channel(channel) for channel in data[category]]
            logger.info(f"分类 {category} 处理完成")
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # 保存结果
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"检测完成，结果已保存到 {output_file}")
        
        # 统计结果
        total_channels = sum(len(data[category]) for category in data if isinstance(data[category], list))
        total_sources = sum(len(channel.get('childItems', [])) for category in data if isinstance(data[category], list) for channel in data[category])
        logger.info(f"最终统计: 共 {total_channels} 个频道, {total_sources} 个可用源")
    except Exception as e:
        logger.error(f"保存结果失败: {str(e)}")

if __name__ == '__main__':
    input_file = 'iptv_sources.json'
    output_file = 'data/iptv_data.json'
    main(input_file, output_file)
