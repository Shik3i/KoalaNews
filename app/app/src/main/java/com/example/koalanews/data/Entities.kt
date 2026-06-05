package com.example.koalanews.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(tableName = "feeds")
data class FeedEntity(
    @PrimaryKey val id: String,
    val url: String,
    val title: String?,
    val description: String?,
    val lastFetchedAt: Long?
)

@Entity(
    tableName = "articles",
    foreignKeys = [
        ForeignKey(
            entity = FeedEntity::class,
            parentColumns = ["id"],
            childColumns = ["feedId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["feedId"])]
)
data class ArticleEntity(
    @PrimaryKey val id: String,
    val feedId: String,
    val title: String?,
    val link: String?,
    val description: String?,
    val imageUrl: String?,
    val pubDate: String?,
    val read: Boolean = false
)
