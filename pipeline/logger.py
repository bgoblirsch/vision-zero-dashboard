import logging
import sys

def get_logger(name: str):
    """
    Returns a configured logger instance.
    - name: typically __name__ of the calling module
    """
    logger = logging.getLogger(name)
    
    if not logger.hasHandlers():  
        logger.setLevel(logging.INFO)

        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '[%(levelname)s] %(asctime)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger