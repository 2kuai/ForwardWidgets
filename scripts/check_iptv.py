#!/usr/bin/env python3
import json
import os
import subprocess
import concurrent.futures
from datetime import datetime
import logging
import requests

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def check_source(source_url):
    """检查单个源的有效性"""
    try:
        # 先检查HTTP可访问性
        if not source_url.startswith(('http://', 'https://')):
            return False, "无效的协议"
            
        # 使用curl进行快速检查
        curl_cmd = [
            'curl', '-s', '-I',
            '--connect-timeout', '5',
            '--max-time', '10',
            source_url
        ]
        
        # 使用ffprobe检查流有效性
        ffprobe_cmd = [
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            '-timeout', '10000000',  # 5秒超时(微秒)
            source_url
        ]
        
        # 执行curl检查
        curl_result = subprocess.run(
            curl_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        if curl_result.returncode != 0:
            return False, "curl检查失败"
            
        # 执行ffprobe检查
        ffprobe_result = subprocess.run(
            ffprobe_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        return ffprobe_result.returncode == 0, "检测通过"
        
    except Exception as e:
        return False, f"检测异常: {str(e)}"

def process_channel(channel, max_workers=10):
    """处理单个频道及其所有源"""
    if 'childItems' not in channel:
        return channel
        
    valid_sources = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = []
        for source in channel['childItems']:
            if 'url' not in source:
                continue
                
            futures.append(
                executor.submit(
                    check_source,
                    source['url']
                )
            )
        
        for i, future in enumerate(concurrent.futures.as_completed(futures)):
            source = channel['childItems'][i]
            is_valid, message = future.result()
            
            if is_valid:
                valid_sources.append(source)
                logger.debug(f"有效源: {source['url']}")
            else:
                logger.info(f"无效源: {source['url']} - 原因: {message}")
    
    channel['childItems'] = valid_sources
    return channel

def main(input_file, output_file, max_workers=10):
    """主函数"""
    logger.info("开始IPTV源检测")
    
    # 检查依赖工具是否可用
    required_tools = ['curl', 'ffmpeg', 'ffprobe']
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
