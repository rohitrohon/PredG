function getFullApiUrl(endpoint) {
  const customUrl = import.meta.env.VITE_API_URL;
  if (customUrl && customUrl.startsWith('http')) {
    return `${customUrl.replace(/\/$/, '')}${endpoint}`;
  }
  const origin = typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : '';
  return `${origin}/api${endpoint}`;
}

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
      const fullUrl = getFullApiUrl(endpoint);
      const response = await fetch(fullUrl, config);
      const text = await response.text();

      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          // If response is HTML or plain text error
          data = { message: text.slice(0, 200) };
        }
      }
      
      if (!response.ok) {
        throw new Error(data.message || `Server error (HTTP ${response.status})`);
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

  async resetPassword(name, email, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ name, email, newPassword })
    });
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

  async deleteGroup(groupId) {
    return this.request(`/group/${groupId}`, {
      method: 'DELETE'
    });
  },

  async updateGroupName(groupId, name) {
    return this.request(`/group/${groupId}`, {
      method: 'PUT',
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

  async fetchPLFixtures(matchweekNumber) {
    return this.request(`/admin/pl-fixtures/${matchweekNumber}`);
  },

  async fetchPLMatchStats(eventId) {
    return this.request(`/admin/pl-match-stats/${eventId}`);
  },

  async getPLStandingsDB() {
    return this.request('/admin/pl-standings-db');
  },

  async refreshPLStandingsDB() {
    return this.request('/admin/pl-standings-db/refresh', {
      method: 'POST'
    });
  },

  async getPLFixturesDB(matchweekNumber) {
    return this.request(`/admin/pl-fixtures-db/${matchweekNumber}`);
  },

  async refreshPLFixturesDB(matchweekNumber) {
    return this.request(`/admin/pl-fixtures-db/refresh/${matchweekNumber}`, {
      method: 'POST'
    });
  },

  async fetchMatchweekResultsAPI(matchweekId) {
    return this.request(`/admin/matchweek/${matchweekId}/fetch-results`, {
      method: 'POST'
    });
  },

  async resetMatchweekResults(matchweekId) {
    return this.request(`/admin/matchweek/${matchweekId}/reset-results`, {
      method: 'POST'
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
  async rejectJoinRequest(groupId, userId) {
    return this.request(`/group/${groupId}/reject-join`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async rejectLeaveRequest(groupId, userId) {
    return this.request(`/group/${groupId}/reject-leave`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  async removeGroupMember(groupId, userId) {
    return this.request(`/group/${groupId}/remove-member`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

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
  },

  async getAdminPredictions(matchweekId) {
    return this.request(`/admin/matchweek/${matchweekId}/predictions`);
  },

  async updateAdminPrediction(predictionId, data) {
    return this.request(`/admin/prediction/${predictionId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async overridePredictionScores(predictionId, data) {
    return this.request(`/admin/prediction/${predictionId}/override-scores`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async overrideBattleResult(battleId, data) {
    return this.request(`/admin/battle/${battleId}/override`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async triggerAutoSyncNow() {
    return this.request('/admin/auto-sync-now', {
      method: 'POST'
    });
  }
};

export default api;
