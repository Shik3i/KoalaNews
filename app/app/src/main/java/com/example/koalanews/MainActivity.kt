package com.example.koalanews

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.koalanews.api.NewsApiClient
import com.example.koalanews.data.AppDatabase
import com.example.koalanews.data.NewsRepository
import com.example.koalanews.data.PreferencesManager
import com.example.koalanews.theme.KoalaNewsTheme
import com.example.koalanews.ui.NewsViewModel

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val database = AppDatabase.getDatabase(applicationContext)
    val preferencesManager = PreferencesManager(applicationContext)
    val apiClient = NewsApiClient(preferencesManager)
    val repository = NewsRepository(database.newsDao(), apiClient, preferencesManager)

    enableEdgeToEdge()
    setContent {
      val viewModel: NewsViewModel = viewModel {
        NewsViewModel(repository, apiClient, preferencesManager)
      }
      
      KoalaNewsTheme(
          themePreference = viewModel.appTheme,
          accentColorPreference = viewModel.appAccentColor
      ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
          MainNavigation(viewModel = viewModel)
        }
      }
    }
  }
}
