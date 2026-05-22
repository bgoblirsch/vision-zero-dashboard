import logging
import os
import sys

def get_logger(name: str):
    logger = logging.getLogger(name)
    
    if not logger.hasHandlers():
        level = logging.DEBUG if os.getenv("FARS_DEBUG") else logging.INFO
        logger.setLevel(level)

        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '[%(levelname)s] %(asctime)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger