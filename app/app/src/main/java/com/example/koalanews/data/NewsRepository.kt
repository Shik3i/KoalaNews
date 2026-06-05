package com.example.koalanews.data

import com.example.koalanews.api.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class NewsRepository(
    private val newsDao: NewsDao,
    private val apiClient: NewsApiClient,
    private val preferencesManager: PreferencesManager
) {
    val feeds: Flow<List<FeedEntity>> = newsDao.getFeeds()
    val articles: Flow<List<ArticleEntity>> = newsDao.getArticles()

    fun getArticlesForFeed(feedId: String): Flow<List<ArticleEntity>> {
        return newsDao.getArticlesForFeed(feedId)
    }

    suspend fun sync(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val response = service.getFeeds(take = 100)

            val feedEntities = response.items.map { dto ->
                FeedEntity(
                    id = dto.id,
                    url = dto.url,
                    title = dto.title,
                    description = dto.description,
                    lastFetchedAt = System.currentTimeMillis()
                )
            }

            val articleEntities = response.items.flatMap { feedItem ->
                feedItem.articles.map { articleDto ->
                    ArticleEntity(
                        id = articleDto.id,
                        feedId = feedItem.id,
                        title = articleDto.title,
                        link = articleDto.link,
                        description = articleDto.description,
                        imageUrl = articleDto.imageUrl,
                        pubDate = articleDto.pubDate,
                        pubDateTimestamp = parsePubDateToTimestamp(articleDto.pubDate),
                        read = articleDto.read
                    )
                }
            }

            // Sync Database
            newsDao.insertFeeds(feedEntities)
            newsDao.insertArticles(articleEntities)

            // Local cleanup: remove feeds that are no longer subscribed on the server
            val serverFeedIds = feedEntities.map { it.id }
            if (serverFeedIds.isEmpty()) {
                newsDao.clearFeeds()
            } else {
                newsDao.deleteFeedsNotIn(serverFeedIds)
            }

            // Keep only the latest 500 articles in the database cache to prevent unbounded growth
            newsDao.keepOnlyLatestArticles(500)

            Result.success(Unit)
        } catch (e: Exception) {
            e.printStackTrace()
            if (e is retrofit2.HttpException && e.code() == 401) {
                newsDao.clearFeeds()
                newsDao.clearArticles()
                preferencesManager.clearSession()
            }
            Result.failure(e)
        }
    }

    suspend fun addFeed(url: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.addFeed(AddFeedRequest(url))
            // Refresh DB after adding
            sync()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun deleteFeed(feedId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.deleteFeed(feedId)
            newsDao.deleteFeed(feedId)
            Result.success(Unit)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun refreshFeed(feedId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.refreshFeed(RefreshFeedRequest(feedId))
            sync()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun markArticleRead(articleId: String, read: Boolean) = withContext(Dispatchers.IO) {
        newsDao.markArticleRead(articleId, read)
        try {
            apiClient.getService().toggleArticleRead(articleId, ToggleReadRequest(read))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun markAllRead(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.markAllRead()
            newsDao.markAllArticlesRead()
            Result.success(Unit)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun getStatistics(): Result<StatisticsResponse> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            Result.success(service.getStatistics())
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun getAdminUsers(query: String?, role: String?): Result<List<AdminUserDto>> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            val response = service.getAdminUsers(query, role)
            Result.success(response.items)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun updateAdminUser(id: String, role: String?, banned: Boolean?, reason: String?): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.updateAdminUser(id, UpdateUserRequest(role, banned, reason))
            Result.success(Unit)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun getAdminSettings(): Result<Map<String, String>> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            Result.success(service.getAdminSettings())
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun updateAdminSettings(settings: Map<String, String>): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val service = apiClient.getService()
            service.updateAdminSettings(settings)
            Result.success(Unit)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun clearLocalData() = withContext(Dispatchers.IO) {
        newsDao.clearFeeds()
        newsDao.clearArticles()
        preferencesManager.clearSession()
    }

    private fun parsePubDateToTimestamp(pubDateString: String?): Long? {
        if (pubDateString.isNullOrEmpty()) return null
        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "EEE, dd MMM yyyy HH:mm:ss z"
        )
        for (format in formats) {
            try {
                val parser = SimpleDateFormat(format, Locale.US)
                if (format.endsWith("'Z'")) {
                    parser.timeZone = TimeZone.getTimeZone("UTC")
                }
                val date = parser.parse(pubDateString)
                if (date != null) return date.time
            } catch (e: Exception) {
                // Ignore and try next format
            }
        }
        return null
    }
}
