import time
import random
from locust import HttpUser, task, between
import json

class BrowsingUser(HttpUser):
    """
    Simulates users who are just browsing the application.
    These users make read-only requests to view public data only.
    """
    wait_time = between(1, 5)  # Wait between 1 and 5 seconds between tasks
    
    def on_start(self):
        # Initialize user session
        self.client.get("/")
    
    @task(3)
    def view_home(self):
        self.client.get("/")
    
    @task(1)
    def view_docs(self):
        self.client.get("/docs")
    
    # Removed tasks that were trying to access protected endpoints without authentication


class AuthenticatedUser(HttpUser):
    """
    Simulates users who are authenticated and performing various operations.
    These users make both read and write requests.
    """
    wait_time = between(3, 8)  # Wait between 3 and 8 seconds between tasks
    
    def on_start(self):
        """Log in at the start of the simulation."""
        self.login()
    
    def login(self):
        """Attempt to log in and store the access token."""
        # Using form data format as required by OAuth2 password flow
        login_data = {
            "username": "aalis",
            "password": "Finger92",
            "grant_type": "password"
        }
        
        # Try to log in
        try:
            response = self.client.post(
                "/api/v1/login/access-token",
                data=login_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                # Store the token for future requests
                self.token = response.json()["access_token"]
                self.auth_headers = {"Authorization": f"Bearer {self.token}"}
                print(f"Successfully logged in as {login_data['username']}")
            else:
                print(f"Login failed with status code {response.status_code}")
                self.token = None
                self.auth_headers = {}
                
        except Exception as e:
            print(f"Login error: {str(e)}")
            self.token = None
            self.auth_headers = {}
    
    @task(3)
    def view_profile(self):
        """View user profile."""
        if hasattr(self, 'auth_headers'):
            self.client.get("/api/v1/users/me", headers=self.auth_headers)
    
    @task(2)
    def view_parsed_groups(self):
        """View parsed groups with authentication."""
        if hasattr(self, 'auth_headers'):
            self.client.get("/api/v1/telegram/parsed-groups/", headers=self.auth_headers)
    
    @task(2)
    def view_parsed_channels(self):
        """View parsed channels with authentication."""
        if hasattr(self, 'auth_headers'):
            self.client.get("/api/v1/telegram/parsed-channels/", headers=self.auth_headers)
    
    @task(1)
    def update_profile(self):
        """Update user profile."""
        if hasattr(self, 'auth_headers'):
            # Get current profile first
            response = self.client.get("/api/v1/users/me", headers=self.auth_headers)
            if response.status_code == 200:
                user_data = response.json()
                # Make a small update
                update_data = {
                    "email": user_data.get("email"),
                    "username": user_data.get("username")
                }
                self.client.put(
                    "/api/v1/users/me", 
                    json=update_data,
                    headers={**self.auth_headers, "Content-Type": "application/json"}
                )


class HeavyUser(HttpUser):
    """
    Simulates users who are performing heavy operations like parsing Telegram groups.
    These users make intensive API calls that put significant load on the server.
    """
    wait_time = between(10, 20)  # Wait between 10 and 20 seconds between tasks
    
    def on_start(self):
        """Log in at the start of the simulation."""
        self.login()
    
    def login(self):
        """Attempt to log in and store the access token."""
        # Using form data format as required by OAuth2 password flow
        login_data = {
            "username": "aalis",
            "password": "Finger92",
            "grant_type": "password"
        }
        
        # Try to log in
        try:
            response = self.client.post(
                "/api/v1/login/access-token",
                data=login_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                # Store the token for future requests
                self.token = response.json()["access_token"]
                self.auth_headers = {"Authorization": f"Bearer {self.token}"}
                print(f"Successfully logged in as {login_data['username']}")
            else:
                print(f"Login failed with status code {response.status_code}")
                self.token = None
                self.auth_headers = {}
                
        except Exception as e:
            print(f"Login error: {str(e)}")
            self.token = None
            self.auth_headers = {}
    
    @task
    def heavy_operation_and_view(self):
        """Simulate a heavy operation and view data."""
        if hasattr(self, 'auth_headers'):
            # First check existing parsed groups
            self.client.get("/api/v1/telegram/parsed-groups/", headers=self.auth_headers)
            
            # Check parse progress (lighter operation than starting a new parse)
            self.client.get("/api/v1/telegram/parse-group/progress", headers=self.auth_headers)
            
            # View some specific group data if available
            groups_response = self.client.get("/api/v1/telegram/parsed-groups/", headers=self.auth_headers)
            if groups_response.status_code == 200:
                groups = groups_response.json()
                if groups and len(groups) > 0:
                    group_id = groups[0].get("id")
                    if group_id:
                        self.client.get(f"/api/v1/telegram/parsed-groups/{group_id}", headers=self.auth_headers)
                        self.client.get(f"/api/v1/telegram/groups/{group_id}/posts/", headers=self.auth_headers) 