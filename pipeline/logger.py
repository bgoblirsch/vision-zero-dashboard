import logging
import sys
import os

def get_logger(name: str):
    """
    Returns a configured logger instance.
    - name: typically __name__ of the calling module
    """
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