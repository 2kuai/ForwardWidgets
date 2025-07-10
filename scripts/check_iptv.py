import json
import requests
import subprocess
from datetime import datetime
import concurrent.futures
import os
import logging
import time

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
            logger.debug(f"HEAD请求成功: {url}")
            return True
        else:
            logger.debug(f"HEAD请求返回非200状态码({response.status_code}): {url}")
            return False
    except Exception as e:
        logger.debug(f"HEAD请求失败({str(e)}): {url}")
        return False

def check_stream_with_curl(url, timeout=15):
    """使用curl检测流媒体可用性"""
    try:
        cmd = [
            'curl',
            '--silent',
            '--fail',
            '--max-time', str(timeout),
            '--range', '0-500',  # 只请求前500字节
            url
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout + 2
        )
        if result.returncode == 0:
            logger.debug(f"curl检测成功: {url}")
            return True
        return False
    except subprocess.TimeoutExpired:
        logger.debug(f"curl检测超时: {url}")
        return False
    except Exception as e:
        logger.debug(f"curl检测异常: {url} - {str(e)}")
        return False

def check_stream_with_ffprobe(url, timeout=15):
    """使用ffprobe检测流媒体信息"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name',
            '-of', 'json',
            '-timeout', str(timeout * 1000000),
            url
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout
        )
        return result.returncode == 0
    except Exception:
        return False

def check_url_availability(url, timeout=15, max_retries=2):
    """检测单个URL的可用性和响应时间"""
    start_time = datetime.now()
    is_available = False
    latency = float('inf')
    
    # 先使用HEAD请求快速筛选
    if not check_url_with_head(url, min(timeout, 5)):
        return False, latency
    
    # 尝试多种检测方法
    methods = [
        check_stream_with_curl,
        check_stream_with_ffprobe
    ]
    
    for attempt in range(max_retries):
        for method in methods:
            try:
                method_timeout = timeout // len(methods)  # 分配超时时间
                if method(url, method_timeout):
                    is_available = True
                    latency = (datetime.now() - start_time).total_seconds() * 1000
                    logger.info(f"检测成功: {url} 方法: {method.__name__} 延迟: {latency:.2f}ms")
                    return is_available, latency
            except Exception as e:
                logger.debug(f"检测失败: {url} 方法: {method.__name__} 错误: {str(e)}")
        
        if attempt < max_retries - 1:
            time.sleep(1)  # 重试前等待1秒
    
    logger.warning(f"URL检测失败: {url}")
    return is_available, latency

def process_channel(channel, max_workers=10):
    """处理单个频道的childItems，并按响应时间排序"""
    if 'childItems' not in channel or not channel['childItems']:
        logger.warning(f"频道 {channel.get('name', '未知')} 没有childItems")
        return channel
    
    logger.info(f"开始处理频道: {channel.get('name', '未知')}")
    
    # 使用线程池并行检测所有childItems
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        urls = channel['childItems']
        futures = {executor.submit(check_url_availability, url): url for url in urls}
        
        url_info = []
        for future in concurrent.futures.as_completed(futures):
            url = futures[future]
            try:
                result = future.result()
                url_info.append((url, result))
            except Exception as e:
                logger.error(f"检测异常: {url} - {str(e)}")
                url_info.append((url, (False, float('inf'))))
    
    # 过滤和排序
    available_urls = [(url, latency) for url, (is_available, latency) in url_info if is_available]
    available_urls.sort(key=lambda x: x[1])  # 按延迟排序
    
    logger.info(f"频道 {channel.get('name', '未知')} 结果: 共 {len(urls)} 个源, 可用 {len(available_urls)} 个")
    channel['childItems'] = [url for url, _ in available_urls]
    return channel

def main(input_file, output_file, max_workers=10):
    """主函数"""
    logger.info("开始IPTV源检测")
    
    # 检查依赖工具是否可用
    required_tools = ['curl', 'ffprobe']
    missing_tools = []
    for tool in required_tools:
        try:
            subprocess.run([tool, '--version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info(f"{tool} 检测通过")
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing_tools.append(tool)
    
    if missing_tools:
        logger.error(f"错误: 缺少必要工具 {', '.join(missing_tools)}，请先安装")
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
        if isinstance(data[category], list):
            logger.info(f"开始处理分类: {category} (共 {len(data[category])} 个频道)")
            data[category] = [process_channel(channel, max_workers) for channel in data[category]]
            logger.info(f"分类 {category} 处理完成")
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # 保存结果
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        # 统计结果
        total_channels = sum(len(data[category]) for category in data if isinstance(data[category], list))
        total_sources = sum(len(channel.get('childItems', [])) for category in data if isinstance(data[category], list) for channel in data[category])
        logger.info(f"检测完成: 共 {total_channels} 个频道, {total_sources} 个可用源")
        logger.info(f"结果已保存到 {output_file}")
    except Exception as e:
        logger.error(f"保存结果失败: {str(e)}")

if __name__ == '__main__':
    input_file = 'iptv_sources.json'
    output_file = 'data/iptv_data.json'
    main(input_file, output_file, max_workers=20)
