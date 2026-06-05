package com.example.koalanews.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface NewsDao {

    @Query("SELECT * FROM feeds ORDER BY title ASC")
    fun getFeeds(): Flow<List<FeedEntity>>

    @Query("SELECT * FROM feeds WHERE id = :feedId LIMIT 1")
    suspend fun getFeedById(feedId: String): FeedEntity?

    @Query("SELECT * FROM articles ORDER BY pubDate DESC, id DESC")
    fun getArticles(): Flow<List<ArticleEntity>>

    @Query("SELECT * FROM articles WHERE feedId = :feedId ORDER BY pubDate DESC, id DESC")
    fun getArticlesForFeed(feedId: String): Flow<List<ArticleEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFeeds(feeds: List<FeedEntity>)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertArticles(articles: List<ArticleEntity>)

    @Query("UPDATE articles SET read = :read WHERE id = :articleId")
    suspend fun markArticleRead(articleId: String, read: Boolean)

    @Query("UPDATE articles SET read = 1")
    suspend fun markAllArticlesRead()

    @Query("UPDATE articles SET read = 1 WHERE feedId = :feedId")
    suspend fun markAllArticlesReadForFeed(feedId: String)

    @Query("DELETE FROM feeds WHERE id = :feedId")
    suspend fun deleteFeed(feedId: String)

    @Query("DELETE FROM feeds WHERE id NOT IN (:feedIds)")
    suspend fun deleteFeedsNotIn(feedIds: List<String>)

    @Query("DELETE FROM feeds")
    suspend fun clearFeeds()

    @Query("DELETE FROM articles")
    suspend fun clearArticles()
}
