package com.example.koalanews.ui.dashboard

import org.junit.Assert.assertEquals
import org.junit.Test

class DashboardScreenTest {

    @Test
    fun formatDate_emptyOrNull_returnsEmpty() {
        assertEquals("", formatDate(null))
        assertEquals("", formatDate(""))
    }

    @Test
    fun formatDate_validIsoDates_formatsCorrectly() {
        // Test standard ISO formats supported by our parser
        val date1 = "2026-06-05T10:15:30.000Z"
        // Since formatDate formats to system default locale, we can check if it returns a non-empty string
        // or check if it starts with the correct day/month depending on date.
        val formatted = formatDate(date1)
        assert(formatted.isNotEmpty())
        assert(formatted.contains("2026"))
    }

    @Test
    fun formatDate_invalidDate_returnsOriginalString() {
        val invalidDate = "not-a-date"
        assertEquals(invalidDate, formatDate(invalidDate))
    }
}
