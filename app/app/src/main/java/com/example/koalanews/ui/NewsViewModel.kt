package com.example.koalanews.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.koalanews.api.LoginRequest
import com.example.koalanews.api.NewsApiClient
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

    // Config & Auth States
    val isAuthenticated: Boolean
        get() = preferencesManager.authToken != null

    val currentServerUrl: String
        get() = preferencesManager.serverUrl

    val currentUserName: String
        get() = preferencesManager.userName ?: preferencesManager.userEmail ?: ""

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

    fun sync() {
        viewModelScope.launch {
            _isSyncing.value = true
            _errorMessage.value = null
            repository.sync()
                .onSuccess {
                    _successMessage.value = "Synchronisiert!"
                }
                .onFailure {
                    _errorMessage.value = "Sync fehlgeschlagen: ${it.localizedMessage}"
                }
            _isSyncing.value = false
        }
    }

    fun clearMessages() {
        _errorMessage.value = null
        _successMessage.value = null
    }

    fun login(serverUrl: String, email: String, password: LoginRequest, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isSyncing.value = true
            _errorMessage.value = null
            try {
                // Temporarily update base URL to verify credentials
                preferencesManager.serverUrl = serverUrl
                val response = apiClient.getService().login(LoginRequest(email, password.password))
                
                preferencesManager.authToken = response.token
                preferencesManager.userEmail = response.user.email
                preferencesManager.userName = response.user.name
                
                _successMessage.value = "Erfolgreich angemeldet!"
                sync()
                onSuccess()
            } catch (e: Exception) {
                e.printStackTrace()
                _errorMessage.value = "Login fehlgeschlagen: ${e.localizedMessage}"
                preferencesManager.clearSession()
            } finally {
                _isSyncing.value = false
            }
        }
    }

    fun logout(onSuccess: () -> Unit) {
        viewModelScope.launch {
            repository.clearLocalData()
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
}
