package com.example.koalanews.api

import com.example.koalanews.data.PreferencesManager
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String?,
    val role: String
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: UserDto
)

@Serializable
data class ArticleDto(
    val id: String,
    val title: String?,
    val link: String?,
    val description: String?,
    val imageUrl: String?,
    val pubDate: String?
)

@Serializable
data class FeedItemDto(
    val id: String,
    val url: String,
    val title: String?,
    val description: String?,
    val articles: List<ArticleDto> = emptyList()
)

@Serializable
data class FeedsResponse(
    val items: List<FeedItemDto>,
    val nextCursor: String? = null
)

@Serializable
data class AddFeedRequest(
    val url: String
)

@Serializable
data class AddFeedResponse(
    val id: String,
    val url: String,
    val title: String? = null
)

@Serializable
data class RefreshFeedRequest(
    val feedId: String
)

@Serializable
data class GeneralResponse(
    val ok: Boolean
)

interface NewsApiService {
    @POST("api/auth/token")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("api/feeds")
    suspend fun getFeeds(@Query("take") take: Int = 100): FeedsResponse

    @POST("api/feeds")
    suspend fun addFeed(@Body request: AddFeedRequest): AddFeedResponse

    @DELETE("api/feeds/{id}")
    suspend fun deleteFeed(@Path("id") id: String): GeneralResponse

    @POST("api/feeds/fetch")
    suspend fun refreshFeed(@Body request: RefreshFeedRequest): GeneralResponse

    @POST("api/articles/read-all")
    suspend fun markAllRead(): GeneralResponse
}

class NewsApiClient(private val preferencesManager: PreferencesManager) {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    private var currentRetrofit: Retrofit? = null
    private var currentService: NewsApiService? = null
    private var cachedBaseUrl: String? = null
    private var cachedToken: String? = null

    @Synchronized
    fun getService(): NewsApiService {
        val serverUrl = preferencesManager.serverUrl
        val token = preferencesManager.authToken
        
        // Rebuild service if the URL or token changes
        if (currentService == null || cachedBaseUrl != serverUrl || cachedToken != token) {
            cachedBaseUrl = serverUrl
            cachedToken = token

            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val authInterceptor = Interceptor { chain ->
                val builder = chain.request().newBuilder()
                builder.header("Content-Type", "application/json")
                token?.let {
                    builder.header("Authorization", "Bearer $it")
                }
                chain.proceed(builder.build())
            }

            val okHttpClient = OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .addInterceptor(logging)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build()

            val baseUrlWithSlash = if (serverUrl.endsWith("/")) serverUrl else "$serverUrl/"

            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrlWithSlash)
                .client(okHttpClient)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()

            currentRetrofit = retrofit
            currentService = retrofit.create(NewsApiService::class.java)
        }
        return currentService!!
    }
}
