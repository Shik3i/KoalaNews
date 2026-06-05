package com.example.koalanews.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.koalanews.api.*
import com.example.koalanews.data.ArticleEntity
import com.example.koalanews.data.FeedEntity
import com.example.koalanews.data.NewsRepository
import com.example.koalanews.data.PreferencesManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class NewsViewModel(
    private val repository: NewsRepository,
    private val apiClient: NewsApiClient,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    // Central Flows
    val feeds: StateFlow<List<FeedEntity>> = repository.feeds
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val articles: StateFlow<List<ArticleEntity>> = repository.articles
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // UI Feedback States
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    // Admin States
    private val _statistics = MutableStateFlow<StatisticsResponse?>(null)
    val statistics: StateFlow<StatisticsResponse?> = _statistics.asStateFlow()

    private val _adminUsers = MutableStateFlow<List<AdminUserDto>>(emptyList())
    val adminUsers: StateFlow<List<AdminUserDto>> = _adminUsers.asStateFlow()

    private val _adminSettings = MutableStateFlow<Map<String, String>>(emptyMap())
    val adminSettings: StateFlow<Map<String, String>> = _adminSettings.asStateFlow()

    // Config & Auth States
    var isAuthenticated by mutableStateOf(preferencesManager.authToken != null)
        private set

    val currentServerUrl: String
        get() = preferencesManager.serverUrl

    val currentUserName: String
        get() = preferencesManager.userName ?: preferencesManager.userEmail ?: ""

    val currentUserRole: String
        get() = preferencesManager.userRole ?: "USER"

    // Appearance State (using Compose mutables to trigger dynamic system updates)
    var appTheme by mutableStateOf(preferencesManager.theme)
        private set
    var appAccentColor by mutableStateOf(preferencesManager.accentColor)
        private set
    var appDensity by mutableStateOf(preferencesManager.density)
        private set
    var appShowImages by mutableStateOf(preferencesManager.showImages)
        private set
    var appShowDescription by mutableStateOf(preferencesManager.showDescription)
        private set

    init {
        if (isAuthenticated) {
            sync()
        }
    }

    private suspend fun performSync() {
        _errorMessage.value = null
        repository.sync()
            .onSuccess {
                _successMessage.value = "Synchronisiert!"
            }
            .onFailure {
                _errorMessage.value = "Sync fehlgeschlagen: ${it.localizedMessage}"
                if (preferencesManager.authToken == null) {
                    isAuthenticated = false
                }
            }
    }

    fun sync() {
        viewModelScope.launch {
            _isSyncing.value = true
            try {
                performSync()
            } finally {
                _isSyncing.value = false
            }
        }
    }

    fun clearMessages() {
        _errorMessage.value = null
        _successMessage.value = null
    }

    fun login(serverUrl: String, email: String, password: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isSyncing.value = true
            _errorMessage.value = null
            try {
                // Temporarily update base URL to verify credentials
                preferencesManager.serverUrl = serverUrl
                val response = apiClient.getService().login(LoginRequest(email, password))
                
                preferencesManager.authToken = response.token
                preferencesManager.userEmail = response.user.email
                preferencesManager.userName = response.user.name
                preferencesManager.userRole = response.user.role
                isAuthenticated = true
                
                _successMessage.value = "Erfolgreich angemeldet!"
                performSync()
                onSuccess()
            } catch (e: Exception) {
                e.printStackTrace()
                _errorMessage.value = "Login fehlgeschlagen: ${e.localizedMessage}"
                preferencesManager.clearSession()
                isAuthenticated = false
            } finally {
                _isSyncing.value = false
            }
        }
    }

    fun logout(onSuccess: () -> Unit) {
        viewModelScope.launch {
            repository.clearLocalData()
            isAuthenticated = false
            onSuccess()
        }
    }

    fun addFeed(url: String) {
        viewModelScope.launch {
            _isSyncing.value = true
            _errorMessage.value = null
            repository.addFeed(url)
                .onSuccess {
                    _successMessage.value = "Feed abonniert!"
                }
                .onFailure {
                    _errorMessage.value = "Feed hinzufügen fehlgeschlagen: ${it.localizedMessage}"
                }
            _isSyncing.value = false
        }
    }

    fun deleteFeed(feedId: String) {
        viewModelScope.launch {
            _isSyncing.value = true
            _errorMessage.value = null
            repository.deleteFeed(feedId)
                .onSuccess {
                    _successMessage.value = "Feed entfernt!"
                }
                .onFailure {
                    _errorMessage.value = "Feed entfernen fehlgeschlagen: ${it.localizedMessage}"
                }
            _isSyncing.value = false
        }
    }

    fun refreshFeed(feedId: String) {
        viewModelScope.launch {
            _isSyncing.value = true
            _errorMessage.value = null
            repository.refreshFeed(feedId)
                .onSuccess {
                    _successMessage.value = "Feed aktualisiert!"
                }
                .onFailure {
                    _errorMessage.value = "Feed aktualisieren fehlgeschlagen: ${it.localizedMessage}"
                }
            _isSyncing.value = false
        }
    }

    fun toggleArticleRead(articleId: String, currentRead: Boolean) {
        viewModelScope.launch {
            repository.markArticleRead(articleId, !currentRead)
        }
    }

    fun markAllArticlesRead() {
        viewModelScope.launch {
            _isSyncing.value = true
            _errorMessage.value = null
            repository.markAllRead()
                .onSuccess {
                    _successMessage.value = "Alle als gelesen markiert!"
                }
                .onFailure {
                    _errorMessage.value = "Fehler beim Markieren: ${it.localizedMessage}"
                }
            _isSyncing.value = false
        }
    }

    // Settings Updates
    fun updateTheme(newTheme: String) {
        preferencesManager.theme = newTheme
        appTheme = newTheme
    }

    fun updateAccentColor(newColor: String) {
        preferencesManager.accentColor = newColor
        appAccentColor = newColor
    }

    fun updateDensity(newDensity: String) {
        preferencesManager.density = newDensity
        appDensity = newDensity
    }

    fun updateShowImages(show: Boolean) {
        preferencesManager.showImages = show
        appShowImages = show
    }

    fun updateShowDescription(show: Boolean) {
        preferencesManager.showDescription = show
        appShowDescription = show
    }

    // Admin Actions
    fun loadStatistics() {
        viewModelScope.launch {
            _isSyncing.value = true
            repository.getStatistics()
                .onSuccess { _statistics.value = it }
                .onFailure { _errorMessage.value = "Statistiken konnten nicht geladen werden: ${it.localizedMessage}" }
            _isSyncing.value = false
        }
    }

    fun loadAdminUsers(query: String? = null, role: String? = null) {
        viewModelScope.launch {
            _isSyncing.value = true
            repository.getAdminUsers(query, role)
                .onSuccess { _adminUsers.value = it }
                .onFailure { _errorMessage.value = "Benutzer konnten nicht geladen werden: ${it.localizedMessage}" }
            _isSyncing.value = false
        }
    }

    fun updateAdminUser(id: String, role: String?, banned: Boolean?, reason: String?, onComplete: () -> Unit) {
        viewModelScope.launch {
            _isSyncing.value = true
            repository.updateAdminUser(id, role, banned, reason)
                .onSuccess {
                    _successMessage.value = "Benutzer aktualisiert!"
                    loadAdminUsers()
                    loadStatistics()
                    onComplete()
                }
                .onFailure { _errorMessage.value = "Benutzer-Update fehlgeschlagen: ${it.localizedMessage}" }
            _isSyncing.value = false
        }
    }

    fun loadAdminSettings() {
        viewModelScope.launch {
            _isSyncing.value = true
            repository.getAdminSettings()
                .onSuccess { _adminSettings.value = it }
                .onFailure { _errorMessage.value = "Admin-Einstellungen konnten nicht geladen werden: ${it.localizedMessage}" }
            _isSyncing.value = false
        }
    }

    fun updateAdminSettings(settings: Map<String, String>) {
        viewModelScope.launch {
            _isSyncing.value = true
            repository.updateAdminSettings(settings)
                .onSuccess {
                    _successMessage.value = "Einstellungen gespeichert!"
                    loadAdminSettings()
                }
                .onFailure { _errorMessage.value = "Einstellungen-Speichern fehlgeschlagen: ${it.localizedMessage}" }
            _isSyncing.value = false
        }
    }
}
