const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = {
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error);
      throw error;
    }
  },

  // Auth endpoints
  async login(emailOrUsername, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername, password })
    });
    this.setToken(data.token);
    return data;
  },

  async signup(name, username, email, password, signupCode) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password, signupCode })
    });
    this.setToken(data.token);
    return data;
  },

  async logout() {
    this.setToken(null);
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async getUsers() {
    return this.request('/auth/users');
  },

  // Group endpoints
  async createGroup(name) {
    return this.request('/group', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async getMyGroups() {
    return this.request('/group/my');
  },

  async joinGroup(code) {
    return this.request('/group/join', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  async approveJoinRequest(groupId, userId) {
    return this.request(`/group/${groupId}/approve-join`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async requestLeave(groupId) {
    return this.request(`/group/${groupId}/request-leave`, {
      method: 'POST'
    });
  },

  async approveLeaveRequest(groupId, userId) {
    return this.request(`/group/${groupId}/approve-leave`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async getGroupMembers(groupId) {
    return this.request(`/group/${groupId}/members`);
  },

  async getGroupStandings(groupId) {
    return this.request(`/group/${groupId}/standings`);
  },

  async getGroupResultsDashboard(groupId) {
    return this.request(`/group/${groupId}/results-dashboard`);
  },

  // Matchweek endpoints (scoped to Group)
  async getMatchweeks(groupId) {
    return this.request(`/matchweek?groupId=${groupId}`);
  },

  async getActiveMatchweek(groupId) {
    return this.request(`/matchweek/active?groupId=${groupId}`);
  },

  async getMatchweek(id) {
    return this.request(`/matchweek/${id}`);
  },

  async createMatchweek(matchweekData) {
    return this.request('/matchweek', {
      method: 'POST',
      body: JSON.stringify(matchweekData)
    });
  },

  async updateMatchweek(id, matchweekData) {
    return this.request(`/matchweek/${id}`, {
      method: 'PUT',
      body: JSON.stringify(matchweekData)
    });
  },

  async setActiveMatchweek(id, groupId) {
    return this.request(`/matchweek/${id}/set-active`, {
      method: 'POST',
      body: JSON.stringify({ groupId })
    });
  },

  async deleteMatchweek(id, groupId) {
    return this.request(`/matchweek/${id}?groupId=${groupId}`, {
      method: 'DELETE'
    });
  },

  // Predictions endpoints (scoped to Group)
  async getMyPredictions(matchweekId, groupId) {
    return this.request(`/predictions/my/${matchweekId}?groupId=${groupId}`);
  },

  async submitPredictions(matchweekId, predictionsData) {
    return this.request(`/predictions/submit/${matchweekId}`, {
      method: 'POST',
      body: JSON.stringify(predictionsData)
    });
  },

  async getMatchweekPredictions(matchweekId, groupId) {
    return this.request(`/predictions/matchweek/${matchweekId}?groupId=${groupId}`);
  },

  // Battle endpoints (scoped to Group)
  async getBattles(matchweekId, groupId) {
    return this.request(`/battle/${matchweekId}?groupId=${groupId}`);
  },

  // Admin actions (Group Admin)
  async updateResults(matchweekId, resultsData) {
    return this.request(`/admin/matchweek/${matchweekId}/results`, {
      method: 'POST',
      body: JSON.stringify(resultsData)
    });
  },

  async pairBattles(matchweekId) {
    return this.request(`/admin/matchweek/${matchweekId}/pair-battles`, {
      method: 'POST'
    });
  },

  async calculateScores(matchweekId) {
    return this.request(`/admin/matchweek/${matchweekId}/calculate`, {
      method: 'POST'
    });
  }
};

export default api;
