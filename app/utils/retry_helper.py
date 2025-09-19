"""
Retry helper utilities for error recovery in API calls and database operations
"""

import time
import logging
from functools import wraps
from typing import Any, Callable, Optional, Tuple, Type
import random

logger = logging.getLogger(__name__)


def exponential_backoff_retry(
    retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    exceptions: Tuple[Type[Exception], ...] = (Exception,)
):
    """
    Decorator for retrying functions with exponential backoff
    
    Args:
        retries: Maximum number of retry attempts
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        exponential_base: Base for exponential backoff calculation
        jitter: Add random jitter to delay to prevent thundering herd
        exceptions: Tuple of exception types to catch and retry
    
    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            delay = initial_delay
            
            for attempt in range(retries + 1):
                try:
                    # Try to execute the function
                    result = func(*args, **kwargs)
                    
                    # Success - log if this was a retry
                    if attempt > 0:
                        logger.info(
                            f"Function {func.__name__} succeeded after {attempt} retry attempt(s)"
                        )
                    
                    return result
                    
                except exceptions as e:
                    last_exception = e
                    
                    # Check if we have retries left
                    if attempt >= retries:
                        logger.error(
                            f"Function {func.__name__} failed after {retries} retry attempts: {str(e)}"
                        )
                        break
                    
                    # Calculate delay with exponential backoff
                    if jitter:
                        # Add random jitter (0.5x to 1.5x the delay)
                        actual_delay = delay * (0.5 + random.random())
                    else:
                        actual_delay = delay
                    
                    # Cap the delay at max_delay
                    actual_delay = min(actual_delay, max_delay)
                    
                    logger.warning(
                        f"Function {func.__name__} failed (attempt {attempt + 1}/{retries + 1}), "
                        f"retrying in {actual_delay:.2f} seconds... Error: {str(e)}"
                    )
                    
                    # Wait before retrying
                    time.sleep(actual_delay)
                    
                    # Increase delay for next retry
                    delay *= exponential_base
            
            # If we get here, all retries failed
            if last_exception:
                raise last_exception
            else:
                raise Exception(f"Function {func.__name__} failed without raising an exception")
        
        return wrapper
    return decorator


def simple_retry(retries: int = 3, delay: float = 1.0):
    """
    Simple decorator for retrying functions with fixed delay
    
    Args:
        retries: Maximum number of retry attempts
        delay: Fixed delay between retries in seconds
    
    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt >= retries:
                        logger.error(
                            f"Function {func.__name__} failed after {retries} retries: {str(e)}"
                        )
                        break
                    
                    logger.warning(
                        f"Function {func.__name__} failed, retrying ({attempt + 1}/{retries})..."
                    )
                    time.sleep(delay)
            
            if last_exception:
                raise last_exception
            else:
                raise Exception(f"Function {func.__name__} failed")
        
        return wrapper
    return decorator


class RetryableError(Exception):
    """Custom exception for errors that should trigger a retry"""
    pass


class NonRetryableError(Exception):
    """Custom exception for errors that should NOT trigger a retry"""
    pass


def is_retryable_http_error(status_code: int) -> bool:
    """
    Determine if an HTTP error code is retryable
    
    Args:
        status_code: HTTP status code
    
    Returns:
        True if the error is retryable, False otherwise
    """
    # Retryable status codes
    retryable_codes = {
        408,  # Request Timeout
        429,  # Too Many Requests
        500,  # Internal Server Error
        502,  # Bad Gateway
        503,  # Service Unavailable
        504,  # Gateway Timeout
    }
    
    return status_code in retryable_codes


def is_retryable_database_error(error_message: str) -> bool:
    """
    Determine if a database error is retryable
    
    Args:
        error_message: Database error message
    
    Returns:
        True if the error is retryable, False otherwise
    """
    retryable_patterns = [
        'connection',
        'timeout',
        'unavailable',
        'too many',
        'rate limit',
        'deadlock',
        'lock wait',
        'connection reset',
        'broken pipe',
    ]
    
    error_lower = error_message.lower()
    return any(pattern in error_lower for pattern in retryable_patterns)


def retry_with_circuit_breaker(
    retries: int = 3,
    delay: float = 1.0,
    failure_threshold: int = 5,
    recovery_timeout: float = 60.0
):
    """
    Advanced retry decorator with circuit breaker pattern
    
    The circuit breaker prevents repeated calls to a failing service,
    giving it time to recover.
    
    Args:
        retries: Maximum number of retry attempts per call
        delay: Delay between retries in seconds
        failure_threshold: Number of failures before opening circuit
        recovery_timeout: Time to wait before attempting recovery
    
    Returns:
        Decorated function with retry and circuit breaker logic
    """
    # Circuit breaker state
    state = {
        'failures': 0,
        'last_failure_time': None,
        'circuit_open': False
    }
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Check if circuit is open
            if state['circuit_open']:
                if state['last_failure_time']:
                    time_since_failure = time.time() - state['last_failure_time']
                    if time_since_failure < recovery_timeout:
                        raise Exception(
                            f"Circuit breaker is open for {func.__name__}. "
                            f"Waiting {recovery_timeout - time_since_failure:.1f}s before retry."
                        )
                    else:
                        # Try to close the circuit
                        logger.info(f"Attempting to close circuit breaker for {func.__name__}")
                        state['circuit_open'] = False
                        state['failures'] = 0
            
            # Try with retries
            last_exception = None
            
            for attempt in range(retries + 1):
                try:
                    result = func(*args, **kwargs)
                    
                    # Reset failure count on success
                    if state['failures'] > 0:
                        logger.info(f"Function {func.__name__} recovered successfully")
                        state['failures'] = 0
                        state['circuit_open'] = False
                    
                    return result
                    
                except Exception as e:
                    last_exception = e
                    state['failures'] += 1
                    state['last_failure_time'] = time.time()
                    
                    # Check if we should open the circuit
                    if state['failures'] >= failure_threshold:
                        state['circuit_open'] = True
                        logger.error(
                            f"Circuit breaker opened for {func.__name__} after "
                            f"{state['failures']} failures"
                        )
                        raise
                    
                    # Check if we have retries left
                    if attempt >= retries:
                        logger.error(f"Function {func.__name__} failed after {retries} retries")
                        break
                    
                    logger.warning(f"Retrying {func.__name__} ({attempt + 1}/{retries})...")
                    time.sleep(delay)
            
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator