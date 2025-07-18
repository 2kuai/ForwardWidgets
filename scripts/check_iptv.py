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
from typing import Tuple, Optional, List, Dict, Any

# 配置日志 - 只保留控制台输出
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class SourceChecker:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'AptvPlayer/1.4.10'  # 统一使用固定UA
        })
        self.timeout = 30  # 全局超时设置
        self.vlc_timeout = 15  # VLC检测超时时间
        self.fixed_ua = "AptvPlayer/1.4.10"  # 固定User-Agent

    def _build_vlc_command(self, url: str) -> List[str]:
        """构建VLC检测命令，根据协议类型添加相应参数"""
        cmd = [
            'cvlc',
            '--intf', 'dummy',
            '--run-time', str(self.vlc_timeout),
            '-vvv',
            '--no-video',  # 不实际播放视频，节省资源
            '--no-audio',  # 不实际播放音频，节省资源
        ]
        
        # 根据协议类型添加UA参数
        parsed = urlparse(url)
        if parsed.scheme in ('http', 'https'):
            cmd.extend(['--http-user-agent', self.fixed_ua])
        elif parsed.scheme == 'rtmp':
            cmd.extend(['--rtmp-user-agent', self.fixed_ua])
        
        cmd.append(url)
        return cmd

    def _vlc_check(self, url: str) -> Tuple[bool, str]:
        """用cvlc检测直播源，分析输出内容判断是否可用"""
        try:
            cmd = self._build_vlc_command(url)
            logger.debug(f"执行VLC命令: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.timeout
            )
            
            output = (result.stdout.decode('utf-8', errors='ignore') + 
                     '\n' + 
                     result.stderr.decode('utf-8', errors='ignore')).lower()
            
            # 判断成功的关键词
            success_keywords = [
                'streaming successfully', 
                'connection succeeded',
                'starting playback',
                'audio output',
                'video output',
                'decoder',
                'stream_out',
                'rtmp',
                'demux'
            ]
            
            # 判断失败的关键词
            failure_keywords = [
                'connection failed',
                'failed to connect',
                'invalid data',
                'access denied',
                'not found'
            ]
            
            if any(kw in output for kw in success_keywords):
                return True, "VLC检测通过，输出包含成功关键词"
            elif any(kw in output for kw in failure_keywords):
                return False, f"VLC检测失败: 输出包含失败关键词。部分输出: {output[:200]}"
            else:
                return False, f"VLC检测不确定: 输出不包含明确关键词。部分输出: {output[:200]}"
                
        except subprocess.TimeoutExpired:
            return False, "VLC检测超时"
        except Exception as e:
            return False, f"VLC检测异常: {str(e)}"

    def check_source_vlc_only(self, url: str) -> Tuple[bool, str, Optional[float]]:
        """只用VLC检测，返回状态、消息和耗时"""
        start_time = time.time()
        ok, msg = self._vlc_check(url)
        elapsed = time.time() - start_time
        return ok, msg, elapsed

def check_dependencies() -> List[str]:
    """检查所有必要依赖是否安装"""
    required_tools = ['cvlc']
    missing_tools = []
    for tool in required_tools:
        try:
            subprocess.run(
                [tool, '--version'],
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

def process_channel(channel: Dict[str, Any], max_workers: int = 10) -> Dict[str, Any]:
    """处理单个频道及其所有源"""
    if 'childItems' not in channel or not channel['childItems']:
        return channel
    
    checker = SourceChecker()
    results = []
    SLOW_THRESHOLD = 10.0  # 慢速阈值(秒)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {
            executor.submit(checker.check_source_vlc_only, url): url 
            for url in channel['childItems']
        }
        
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                ok, msg, check_time = future.result()
            except Exception as exc:
                ok, msg, check_time = False, f'检测异常: {exc}', None
            
            speed = 'fast' if (check_time or 0) <= SLOW_THRESHOLD else 'slow'
            logger.info(
                f"\n频道: 【{channel.get('name','')}】  {url}"
                f"\n状态: {'✅' if ok else '❌'} | 速率: {speed} | 耗时: {check_time:.2f}s"
                f"\n结果: {msg}"
            )
            
            if ok:
                results.append((check_time, url))
    
    # 按检测时间升序排序
    results.sort(key=lambda x: x[0])
    channel['childItems'] = [item[1] for item in results]
    return channel

def main(input_file: str, output_file: str, max_workers: int = 10):
    """主函数"""
    logger.info("开始IPTV源检测")
    
    # 检查依赖
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
    
    # 更新最后修改时间
    data['last_updated'] = datetime.now().isoformat()
    
    # 处理每个分类
    for category in data:
        if isinstance(data[category], list):
            count = len(data[category])
            logger.info(f"处理分类: {category} (共 {count} 个频道)")
            data[category] = [process_channel(channel, max_workers) for channel in data[category]]
            logger.info(f"分类 {category} 完成")
    
    # 写入输出文件
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    temp_file = output_file + '.tmp'
    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(temp_file, output_file)
        logger.info(f"检测完成，结果已保存到: {output_file}")
    except Exception as e:
        logger.error(f"保存结果失败: {str(e)}")
        if os.path.exists(temp_file):
            os.unlink(temp_file)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='IPTV直播源检测工具')
    parser.add_argument('-i', '--input', default='iptv_sources.json', 
                       help='输入JSON文件路径 (默认: iptv_sources.json)')
    parser.add_argument('-o', '--output', default='data/iptv-data.json', 
                       help='输出JSON文件路径 (默认: data/iptv-data.json)')
    parser.add_argument('-w', '--workers', type=int, default=10, 
                       help='并发工作线程数 (默认: 10)')
    parser.add_argument('-v', '--verbose', action='store_true', 
                       help='启用详细日志')
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    main(args.input, args.output, args.workers)
