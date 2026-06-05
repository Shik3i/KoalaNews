package com.example.koalanews.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

@Composable
fun KoalaNewsTheme(
    themePreference: String = "system",
    accentColorPreference: String = "blue",
    content: @Composable () -> Unit
) {
    val darkTheme = when (themePreference) {
        "light" -> false
        "dark" -> true
        else -> isSystemInDarkTheme()
    }

    val colorScheme = if (darkTheme) {
        when (accentColorPreference) {
            "green" -> darkColorScheme(
                primary = GreenPrimaryDark,
                secondary = GreenSecondaryDark,
                tertiary = GreenTertiaryDark,
                background = BackgroundDark,
                surface = SurfaceDark
            )
            "orange" -> darkColorScheme(
                primary = OrangePrimaryDark,
                secondary = OrangeSecondaryDark,
                tertiary = OrangeTertiaryDark,
                background = BackgroundDark,
                surface = SurfaceDark
            )
            "purple" -> darkColorScheme(
                primary = PurplePrimaryDark,
                secondary = PurpleSecondaryDark,
                tertiary = PurpleTertiaryDark,
                background = BackgroundDark,
                surface = SurfaceDark
            )
            else -> darkColorScheme(
                primary = BluePrimaryDark,
                secondary = BlueSecondaryDark,
                tertiary = BlueTertiaryDark,
                background = BackgroundDark,
                surface = SurfaceDark
            )
        }
    } else {
        when (accentColorPreference) {
            "green" -> lightColorScheme(
                primary = GreenPrimaryLight,
                secondary = GreenSecondaryLight,
                tertiary = GreenTertiaryLight,
                background = BackgroundLight,
                surface = SurfaceLight
            )
            "orange" -> lightColorScheme(
                primary = OrangePrimaryLight,
                secondary = OrangeSecondaryLight,
                tertiary = OrangeTertiaryLight,
                background = BackgroundLight,
                surface = SurfaceLight
            )
            "purple" -> lightColorScheme(
                primary = PurplePrimaryLight,
                secondary = PurpleSecondaryLight,
                tertiary = PurpleTertiaryLight,
                background = BackgroundLight,
                surface = SurfaceLight
            )
            else -> lightColorScheme(
                primary = BluePrimaryLight,
                secondary = BlueSecondaryLight,
                tertiary = BlueTertiaryLight,
                background = BackgroundLight,
                surface = SurfaceLight
            )
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
