"""
Canvas API Client for EaselyBot
Handles Canvas LMS API integration including token validation and assignment fetching
"""

import logging
import requests
from typing import Dict, List, Optional, Any
from config.settings import CANVAS_BASE_URL, CANVAS_API_VERSION
from app.utils.retry_helper import exponential_backoff_retry, is_retryable_http_error

logger = logging.getLogger(__name__)


class CanvasAPIClient:
    """Canvas LMS API client for token validation and data fetching"""
    
    def __init__(self):
        self.base_url = CANVAS_BASE_URL
        self.api_version = CANVAS_API_VERSION
        
    @exponential_backoff_retry(
        retries=3,
        initial_delay=1.0,
        max_delay=10.0,
        exceptions=(requests.exceptions.RequestException, requests.exceptions.Timeout)
    )
    def _make_request(self, token: str, endpoint: str, method: str = 'GET', params: Dict = None) -> Optional[Any]:
        """
        Make authenticated request to Canvas API with retry logic
        
        Args:
            token: Canvas access token
            endpoint: API endpoint (without /api/v1 prefix)
            method: HTTP method
            params: Query parameters
            
        Returns:
            Response data or None if failed
        """
        try:
            url = f"{self.base_url}/api/{self.api_version}/{endpoint}"
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params or {},
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            elif is_retryable_http_error(response.status_code):
                # Raise exception to trigger retry for retryable errors
                raise requests.exceptions.RequestException(
                    f"Retryable Canvas API error: {response.status_code} - {response.text}"
                )
            else:
                logger.error(f"Canvas API error (non-retryable): {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            # Let the decorator handle retries for these exceptions
            logger.warning(f"Canvas API request failed, will retry: {str(e)}")
            raise
    
    def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate Canvas access token by fetching user profile
        
        Args:
            token: Canvas access token to validate
            
        Returns:
            Dict with validation result:
            {
                'valid': bool,
                'user_info': dict or None,
                'error_message': str or None
            }
        """
        try:
            # Test token by getting user profile
            user_data = self._make_request(token, 'users/self')
            
            if user_data:
                return {
                    'valid': True,
                    'user_info': {
                        'id': user_data.get('id'),
                        'name': user_data.get('name'),
                        'email': user_data.get('email'),
                        'login_id': user_data.get('login_id')
                    },
                    'error_message': None
                }
            else:
                return {
                    'valid': False,
                    'user_info': None,
                    'error_message': 'Invalid token or Canvas server error'
                }
                
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return {
                'valid': False,
                'user_info': None,
                'error_message': f'Validation error: {str(e)}'
            }
    
    def get_user_courses(self, token: str) -> List[Dict[str, Any]]:
        """
        Get user's active courses
        
        Args:
            token: Canvas access token
            
        Returns:
            List of course dictionaries
        """
        try:
            courses = self._make_request(token, 'courses', params={
                'enrollment_state': 'active',
                'per_page': 100
            })
            
            if courses:
                return [{
                    'id': course.get('id'),
                    'name': course.get('name'),
                    'course_code': course.get('course_code'),
                    'term': course.get('term', {}).get('name', 'Unknown')
                } for course in courses]
            
            return []
            
        except Exception as e:
            logger.error(f"Error fetching courses: {str(e)}")
            return []
    
    def get_assignments(self, token: str, limit: int = 500) -> List[Dict[str, Any]]:
        """
        Get upcoming assignments across all courses
        
        Args:
            token: Canvas access token
            limit: Maximum number of assignments to return
            
        Returns:
            List of assignment dictionaries
        """
        try:
            logger.info(f"Fetching assignments from Canvas API (limit: {limit})")
            
            # First get user's courses
            courses = self.get_user_courses(token)
            logger.info(f"Found {len(courses)} courses for user")
            
            if not courses:
                logger.warning("No courses found for user")
                return []
            
            assignments = []
            
            for course in courses:  # Get ALL courses, not just first 10
                logger.debug(f"Fetching assignments for course: {course['name']} ({course['id']})")
                
                course_assignments = self._make_request(
                    token, 
                    f'courses/{course["id"]}/assignments',
                    params={
                        'per_page': 100,  # Get more assignments per course
                        'order_by': 'due_at'
                    }
                )
                
                if course_assignments:
                    logger.info(f"Found {len(course_assignments)} assignments in {course['name']}")
                    
                    for assignment in course_assignments:
                        # Only include assignments with due dates
                        if assignment.get('due_at'):
                            assignments.append({
                                'id': assignment.get('id'),
                                'title': assignment.get('name'),
                                'course_name': course['name'],
                                'course_code': course['course_code'],
                                'due_date': assignment.get('due_at'),
                                'description': assignment.get('description', ''),
                                'points_possible': assignment.get('points_possible'),
                                'submission_types': assignment.get('submission_types', []),
                                'html_url': assignment.get('html_url')
                            })
                        else:
                            logger.debug(f"Skipping assignment '{assignment.get('name')}' - no due date")
                else:
                    logger.info(f"No assignments found in {course['name']}")
            
            logger.info(f"Total assignments with due dates found: {len(assignments)}")
            
            # Sort by due date and return ALL assignments (no limit)
            assignments.sort(key=lambda x: x['due_date'] or '')
            
            logger.info(f"Returning ALL {len(assignments)} assignments (no limit)")
            return assignments
            
        except Exception as e:
            logger.error(f"Error fetching assignments: {str(e)}")
            return []
    
    def get_upcoming_assignments(self, token: str, days_ahead: int = 14) -> List[Dict[str, Any]]:
        """
        Get assignments due in the next X days (FUTURE ONLY, not past)
        
        Args:
            token: Canvas access token
            days_ahead: Number of days to look ahead
            
        Returns:
            List of upcoming assignment dictionaries
        """
        try:
            from datetime import datetime, timedelta, timezone
            now = datetime.now(timezone.utc)
            cutoff_date = now + timedelta(days=days_ahead)
            
            # Get ALL assignments from ALL courses
            all_assignments = self.get_assignments(token, limit=500)
            upcoming = []
            
            for assignment in all_assignments:
                if assignment['due_date']:
                    try:
                        # Parse Canvas datetime format
                        due_date = datetime.fromisoformat(assignment['due_date'].replace('Z', '+00:00'))
                        # ONLY include FUTURE assignments (due_date > now) and within cutoff
                        if now <= due_date <= cutoff_date:
                            upcoming.append(assignment)
                    except (ValueError, AttributeError):
                        continue
            
            return upcoming  # Return ALL upcoming, no limit
            
        except Exception as e:
            logger.error(f"Error fetching upcoming assignments: {str(e)}")
            return []
    
    def create_calendar_event(self, token: str, title: str, start_at: str, end_at: str = None, description: str = None) -> Dict[str, Any]:
        """
        Create a calendar event in Canvas (user's personal calendar)
        
        Args:
            token: Canvas access token
            title: Event title
            start_at: Event start datetime in ISO format
            end_at: Event end datetime (optional, defaults to start_at)
            description: Event description (optional)
            
        Returns:
            Created event data or error dict
        """
        try:
            # If no end time specified, make it same as start (all-day or point event)
            if not end_at:
                end_at = start_at
            
            # Prepare event data
            event_data = {
                'calendar_event': {
                    'context_code': 'user_self',  # Personal calendar
                    'title': title,
                    'start_at': start_at,
                    'end_at': end_at
                }
            }
            
            if description:
                event_data['calendar_event']['description'] = description
            
            # Make POST request to create event
            url = f"{self.base_url}/api/{self.api_version}/calendar_events"
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                url=url,
                headers=headers,
                json=event_data,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                event = response.json()
                logger.info(f"Created Canvas calendar event: {title}")
                return {
                    'success': True,
                    'event_id': event.get('id'),
                    'title': event.get('title'),
                    'start_at': event.get('start_at'),
                    'html_url': event.get('html_url')
                }
            else:
                logger.error(f"Failed to create calendar event: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"Canvas API error: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Error creating calendar event: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# Global Canvas API client instance
canvas_client = CanvasAPIClient()


def validate_canvas_token(token: str) -> Dict[str, Any]:
    """
    Convenience function to validate a Canvas token
    
    Args:
        token: Canvas access token
        
    Returns:
        Validation result dictionary
    """
    return canvas_client.validate_token(token)


def fetch_user_assignments(token: str, limit: int = 500) -> List[Dict[str, Any]]:
    """
    Convenience function to fetch user assignments
    
    Args:
        token: Canvas access token
        limit: Maximum assignments to return (default 200 for all)
        
    Returns:
        List of assignment dictionaries
    """
    # Get assignments for the next 90 days to ensure we get all relevant ones
    assignments = canvas_client.get_upcoming_assignments(token, days_ahead=90)
    # Return all assignments, not truncated
    return assignments
