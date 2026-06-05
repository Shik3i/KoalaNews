package com.example.koalanews.data

import android.content.Context
import android.content.SharedPreferences

class PreferencesManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("koalanews_preferences", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_NAME = "user_name"
        
        // Appearance Settings
        private const val KEY_THEME = "theme" // "system", "light", "dark"
        private const val KEY_DENSITY = "density" // "comfortable", "compact"
        private const val KEY_ACCENT_COLOR = "accent_color" // "blue", "green", "red", "purple"
        private const val KEY_SHOW_IMAGES = "show_images"
        private const val KEY_SHOW_DESCRIPTION = "show_description"
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "https://news.koalastuff.net") ?: "https://news.koalastuff.net"
        set(value) {
            val normalized = if (value.endsWith("/")) value.substring(0, value.length - 1) else value
            prefs.edit().putString(KEY_SERVER_URL, normalized).apply()
        }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    var userEmail: String?
        get() = prefs.getString(KEY_USER_EMAIL, null)
        set(value) = prefs.edit().putString(KEY_USER_EMAIL, value).apply()

    var userName: String?
        get() = prefs.getString(KEY_USER_NAME, null)
        set(value) = prefs.edit().putString(KEY_USER_NAME, value).apply()

    var theme: String
        get() = prefs.getString(KEY_THEME, "system") ?: "system"
        set(value) = prefs.edit().putString(KEY_THEME, value).apply()

    var density: String
        get() = prefs.getString(KEY_DENSITY, "comfortable") ?: "comfortable"
        set(value) = prefs.edit().putString(KEY_DENSITY, value).apply()

    var accentColor: String
        get() = prefs.getString(KEY_ACCENT_COLOR, "blue") ?: "blue"
        set(value) = prefs.edit().putString(KEY_ACCENT_COLOR, value).apply()

    var showImages: Boolean
        get() = prefs.getBoolean(KEY_SHOW_IMAGES, true)
        set(value) = prefs.edit().putBoolean(KEY_SHOW_IMAGES, value).apply()

    var showDescription: Boolean
        get() = prefs.getBoolean(KEY_SHOW_DESCRIPTION, true)
        set(value) = prefs.edit().putBoolean(KEY_SHOW_DESCRIPTION, value).apply()

    fun clearSession() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_NAME)
            .apply()
    }
}
