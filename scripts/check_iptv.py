#!/usr/bin/env python3
import json
import os
import subprocess
import concurrent.futures
from datetime import datetime
import logging
import requests
import time
from urllib.parse import urlparse

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SourceChecker:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.timeout = 10  # 全局超时设置

    def check_http_source(self, url):
        """检查HTTP/HTTPS源的多阶段验证"""
        try:
            # 第一阶段：HEAD请求检查基本可访问性
            try:
                head_response = self.session.head(
                    url,
                    timeout=self.timeout,
                    allow_redirects=True
                )
                head_response.raise_for_status()
                
                # 检查Content-Type
                content_type = head_response.headers.get('Content-Type', '').lower()
                if 'video' not in content_type and 'audio' not in content_type:
                    return False, "无效的Content-Type"
                    
            except requests.RequestException as e:
                return False, f"HEAD请求失败: {str(e)}"

            # 第二阶段：部分GET请求检查内容签名
            try:
                get_response = self.session.get(
                    url,
                    timeout=self.timeout,
                    headers={'Range': 'bytes=0-1024'},  # 只获取前1KB
                    stream=True
                )
                get_response.raise_for_status()
                
                # 检查常见流媒体签名
                content = next(get_response.iter_content(1024))
                if not any(sig in content for sig in [b'#EXTM3U', b'FLV', b'ftyp']):
                    return False, "无效的流媒体格式"
                    
            except requests.RequestException as e:
                return False, f"GET请求失败: {str(e)}"

            # 第三阶段：FFprobe完整验证
            return self._ffprobe_check(url)
            
        except Exception as e:
            return False, f"HTTP检测异常: {str(e)}"

    def check_rtmp_source(self, url):
        """RTMP源专用检测"""
        try:
            # 基本URL解析
            parsed = urlparse(url)
            if not parsed.netloc:
                return False, "无效的RTMP URL"

            # 使用FFprobe进行RTMP验证
            return self._ffprobe_check(url, is_rtmp=True)
            
        except Exception as e:
            return False, f"RTMP检测异常: {str(e)}"

    def _ffprobe_check(self, url, is_rtmp=False):
        """使用FFprobe进行流验证的通用方法"""
        try:
            if is_rtmp:
                probe_cmd = [
                    'ffprobe', '-v', 'error',
                    '-rw_timeout', '10000000',  # 10秒超时
                    '-select_streams', 'v:0',
                    '-show_entries', 'format=duration',
                    '-of', 'csv=print_section=0',
                    url
                ]
            else:
                probe_cmd = [
                    'ffprobe', '-v', 'error',
                    '-timeout', '10000000',  # 10秒超时(微秒)
                    '-select_streams', 'v:0',
                    '-show_entries', 'stream=codec_name,width,height',
                    '-of', 'csv=print_section=0',
                    url
                ]

            probe_result = subprocess.run(
                probe_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.timeout
            )

            if probe_result.returncode != 0:
                error_msg = probe_result.stderr.decode('utf-8').strip()
                return False, f"FFprobe验证失败: {error_msg if error_msg else '未知错误'}"

            # 解析输出结果
            output = probe_result.stdout.decode('utf-8').strip()
            if is_rtmp:
                if not output or float(output) <= 0:
                    return False, "无效的流持续时间"
            else:
                if not output:
                    return False, "无视频流信息"
                codec, width, height = output.split(',')
                if not codec or not width or not height:
                    return False, "不完整的流信息"

            return True, "验证通过"
            
        except subprocess.TimeoutExpired:
            return False, "FFprobe检测超时"
        except Exception as e:
            return False, f"FFprobe检测异常: {str(e)}"

    def check_source(self, url):
        """统一入口方法"""
        start_time = time.time()
        
        try:
            # 协议检查
            if url.startswith(('http://', 'https://')):
                result, message = self.check_http_source(url)
            elif url.startswith('rtmp://'):
                result, message = self.check_rtmp_source(url)
            else:
                return False, "不支持的协议"

            elapsed = time.time() - start_time
            logger.debug(f"检测完成 [{elapsed:.2f}s]: {url} - {'有效' if result else '无效'} ({message})")
            return result, message
            
        except Exception as e:
            return False, f"全局检测异常: {str(e)}"

def process_channel(channel, max_workers=10):
    """处理单个频道及其所有源（优化线程池使用）"""
    if 'childItems' not in channel or not channel['childItems']:
        return channel
        
    checker = SourceChecker()
    valid_sources = []
    futures = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有检测任务
        for source in channel['childItems']:
            if 'url' not in source:
                continue
            futures.append(executor.submit(checker.check_source, source['url']))
        
        # 收集结果
        for i, future in enumerate(concurrent.futures.as_completed(futures)):
            source = channel['childItems'][i]
            is_valid, message = future.result()
            
            if is_valid:
                valid_sources.append(source)
                logger.info(f"有效源: {source['url']}")
            else:
                logger.warning(f"无效源: {source['url']} - 原因: {message}")
    
    channel['childItems'] = valid_sources
    return channel

def check_dependencies():
    """检查所有必要依赖是否安装"""
    required_tools = ['ffmpeg', 'ffprobe']
    missing_tools = []
    
    for tool in required_tools:
        try:
            # 检查工具是否存在且基本功能正常
            subprocess.run(
                [tool, '-version'],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5
            )
            logger.info(f"{tool} 检测通过")
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
            missing_tools.append(tool)
            logger.error(f"{tool} 检测失败: {str(e)}")
    
    return missing_tools

def main(input_file, output_file, max_workers=10):
    """主函数"""
    logger.info("开始IPTV源检测")
    
    # 检查依赖工具
    missing_tools = check_dependencies()
    if missing_tools:
        logger.error(f"错误: 缺少必要工具 {', '.join(missing_tools)}")
        return
    
    # 读取输入文件
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        logger.info(f"成功读取输入文件: {input_file}")
    except Exception as e:
        logger.error(f"读取输入文件失败: {str(e)}")
        return
    
    # 更新元数据
    data['last_updated'] = datetime.now().isoformat()
    data['stats'] = {
        'total_channels': 0,
        'valid_sources': 0
    }
    
    # 处理所有频道
    for category in data:
        if isinstance(data[category], list):
            count = len(data[category])
            logger.info(f"处理分类: {category} (共 {count} 个频道)")
            
            data[category] = [process_channel(channel, max_workers) 
                            for channel in data[category]]
            
            valid_count = sum(len(c['childItems']) for c in data[category] 
                             if 'childItems' in c)
            data['stats']['total_channels'] += count
            data['stats']['valid_sources'] += valid_count
            
            logger.info(f"分类 {category} 完成 - 有效源: {valid_count}/{count}")
    
    # 保存结果（原子写入）
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    temp_file = output_file + '.tmp'
    
    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        os.replace(temp_file, output_file)
        logger.info(f"检测完成 - 总计: {data['stats']['total_channels']} 频道, "
                   f"{data['stats']['valid_sources']} 有效源")
    except Exception as e:
        logger.error(f"保存结果失败: {str(e)}")
        if os.path.exists(temp_file):
            os.unlink(temp_file)

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input', default='iptv_sources.json',
                      help='输入JSON文件路径')
    parser.add_argument('-o', '--output', default='data/iptv_data.json',
                      help='输出JSON文件路径')
    parser.add_argument('-w', '--workers', type=int, default=10,
                      help='并发工作线程数')
    parser.add_argument('-v', '--verbose', action='store_true',
                      help='启用详细日志')
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    main(args.input, args.output, args.workers)
