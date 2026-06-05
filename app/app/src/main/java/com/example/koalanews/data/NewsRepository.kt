package com.example.koalanews.data

import com.example.koalanews.api.AddFeedRequest
import com.example.koalanews.api.NewsApiClient
import com.example.koalanews.api.RefreshFeedRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
                        pubDate = articleDto.pubDate
                        // default read status is false; if it's already in the database with true,
                        // OnConflictStrategy.IGNORE will ensure it is not overwritten.
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

    suspend fun clearLocalData() = withContext(Dispatchers.IO) {
        newsDao.clearFeeds()
        newsDao.clearArticles()
        preferencesManager.clearSession()
    }
}
