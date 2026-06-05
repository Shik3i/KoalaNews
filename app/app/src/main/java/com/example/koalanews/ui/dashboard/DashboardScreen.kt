package com.example.koalanews.ui.dashboard

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.example.koalanews.data.ArticleEntity
import com.example.koalanews.data.FeedEntity
import com.example.koalanews.ui.NewsViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: NewsViewModel,
    onLogoutSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    var activeTab by remember { mutableIntStateOf(0) }
    
    val feeds by viewModel.feeds.collectAsStateWithLifecycle()
    val articles by viewModel.articles.collectAsStateWithLifecycle()
    val isSyncing by viewModel.isSyncing.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val successMessage by viewModel.successMessage.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }

    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    icon = { Icon(Icons.Default.List, contentDescription = "Artikel") },
                    label = { Text("Artikel") }
                )
                NavigationBarItem(
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    icon = { Icon(Icons.Default.RssFeed, contentDescription = "Feeds") },
                    label = { Text("Feeds") }
                )
                NavigationBarItem(
                    selected = activeTab == 2,
                    onClick = { activeTab = 2 },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Einstellungen") },
                    label = { Text("Einstellungen") }
                )
            }
        },
        modifier = modifier.fillMaxSize()
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (activeTab) {
                0 -> ArticlesTab(
                    articles = articles,
                    feeds = feeds,
                    isSyncing = isSyncing,
                    viewModel = viewModel
                )
                1 -> FeedsTab(
                    feeds = feeds,
                    isSyncing = isSyncing,
                    viewModel = viewModel
                )
                2 -> SettingsTab(
                    viewModel = viewModel,
                    onLogoutSuccess = onLogoutSuccess
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticlesTab(
    articles: List<ArticleEntity>,
    feeds: List<FeedEntity>,
    isSyncing: Boolean,
    viewModel: NewsViewModel
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedFeedId by remember { mutableStateOf<String?>(null) }
    var unreadOnly by remember { mutableStateOf(false) }

    val filteredArticles = remember(articles, searchQuery, selectedFeedId, unreadOnly) {
        articles.filter { article ->
            val matchesSearch = searchQuery.isEmpty() || 
                (article.title?.contains(searchQuery, ignoreCase = true) == true) || 
                (article.description?.contains(searchQuery, ignoreCase = true) == true)
            val matchesFeed = selectedFeedId == null || article.feedId == selectedFeedId
            val matchesUnread = !unreadOnly || !article.read
            matchesSearch && matchesFeed && matchesUnread
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Search & Filters Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Suche Artikel...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                )
            )
            
            Spacer(modifier = Modifier.height(8.dp))

            // Filter options row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Filter: Unread Only
                FilterChip(
                    selected = unreadOnly,
                    onClick = { unreadOnly = !unreadOnly },
                    label = { Text("Ungelesen") },
                    leadingIcon = if (unreadOnly) {
                        { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    } else null
                )

                // Filter: Feed selector dropdown
                var dropdownExpanded by remember { mutableStateOf(false) }
                Box {
                    val selectedFeedName = feeds.find { it.id == selectedFeedId }?.title ?: "Alle Feeds"
                    InputChip(
                        selected = selectedFeedId != null,
                        onClick = { dropdownExpanded = true },
                        label = { Text(selectedFeedName) },
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, contentDescription = null) }
                    )
                    DropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Alle Feeds") },
                            onClick = {
                                selectedFeedId = null
                                dropdownExpanded = false
                            }
                        )
                        feeds.forEach { feed ->
                            DropdownMenuItem(
                                text = { Text(feed.title ?: feed.url) },
                                onClick = {
                                    selectedFeedId = feed.id
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // Manual Sync Icon Button
                IconButton(onClick = { viewModel.sync() }, enabled = !isSyncing) {
                    if (isSyncing) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = "Aktualisieren")
                    }
                }
            }
        }

        // Articles List
        if (filteredArticles.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.RssFeed,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Keine Artikel gefunden",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredArticles, key = { it.id }) { article ->
                    val feed = feeds.find { it.id == article.feedId }
                    ArticleItem(
                        article = article,
                        feedName = feed?.title ?: feed?.url ?: "RSS Feed",
                        viewModel = viewModel
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleItem(
    article: ArticleEntity,
    feedName: String,
    viewModel: NewsViewModel
) {
    val context = LocalContext.current
    val density = viewModel.appDensity
    val showImages = viewModel.appShowImages
    val showDescription = viewModel.appShowDescription

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            if (dismissValue == SwipeToDismissBoxValue.EndToStart || dismissValue == SwipeToDismissBoxValue.StartToEnd) {
                viewModel.toggleArticleRead(article.id, article.read)
                false // Don't actually dismiss item from view, just toggle status!
            } else {
                false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromEndToStart = true,
        enableDismissFromStartToEnd = true,
        backgroundContent = {
            val direction = dismissState.dismissDirection
            val color = if (article.read) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary
            val alignment = if (direction == SwipeToDismissBoxValue.StartToEnd) Alignment.CenterStart else Alignment.CenterEnd
            val icon = if (article.read) Icons.Default.MarkEmailUnread else Icons.Default.MarkEmailRead
            val label = if (article.read) "Ungelesen" else "Gelesen"

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(12.dp))
                    .background(color.copy(alpha = 0.8f))
                    .padding(horizontal = 24.dp),
                contentAlignment = alignment
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(icon, contentDescription = null, tint = Color.White)
                    Text(label, color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    ) {
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (article.read) {
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                } else {
                    MaterialTheme.colorScheme.surface
                }
            ),
            elevation = CardDefaults.cardElevation(
                defaultElevation = if (article.read) 0.dp else 2.dp
            ),
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    // Mark as read when clicked
                    if (!article.read) {
                        viewModel.toggleArticleRead(article.id, false)
                    }
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(article.link))
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
        ) {
            if (density == "compact") {
                // Compact style layout
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Small unread indicator
                    if (!article.read) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(MaterialTheme.colorScheme.primary, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = article.title ?: "Ohne Titel",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = if (article.read) FontWeight.Normal else FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "$feedName • ${formatDate(article.pubDate)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                // Comfortable magazine style layout
                Column(modifier = Modifier.fillMaxWidth()) {
                    if (showImages && !article.imageUrl.isNullOrEmpty()) {
                        AsyncImage(
                            model = article.imageUrl,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp)
                        )
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = feedName,
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold
                            )
                            
                            if (!article.read) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .background(MaterialTheme.colorScheme.primary, CircleShape)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = article.title ?: "Ohne Titel",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = if (article.read) FontWeight.Normal else FontWeight.Bold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )

                        if (showDescription && !article.description.isNullOrEmpty()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = article.description.stripHtml(),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = formatDate(article.pubDate),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun FeedsTab(
    feeds: List<FeedEntity>,
    isSyncing: Boolean,
    viewModel: NewsViewModel
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var feedUrlInput by remember { mutableStateOf("") }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Feed hinzufügen")
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Abonnierte Feeds (${feeds.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                IconButton(onClick = { viewModel.sync() }, enabled = !isSyncing) {
                    if (isSyncing) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = "Aktualisieren")
                    }
                }
            }

            if (feeds.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Keine Feeds abonniert. Klicke auf +, um einen hinzuzufügen.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(32.dp)
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(feeds, key = { it.id }) { feed ->
                        FeedItemCard(feed = feed, viewModel = viewModel)
                    }
                }
            }
        }

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Feed hinzufügen") },
                text = {
                    OutlinedTextField(
                        value = feedUrlInput,
                        onValueChange = { feedUrlInput = it },
                        label = { Text("Feed RSS URL") },
                        placeholder = { Text("https://example.com/rss.xml") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (feedUrlInput.isNotEmpty()) {
                                viewModel.addFeed(feedUrlInput.trim())
                                feedUrlInput = ""
                                showAddDialog = false
                            }
                        }
                    ) {
                        Text("Hinzufügen")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) {
                        Text("Abbrechen")
                    }
                }
            )
        }
    }
}

@Composable
fun FeedItemCard(feed: FeedEntity, viewModel: NewsViewModel) {
    var isConfirmDelete by remember { mutableStateOf(false) }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = feed.title ?: feed.url,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = feed.url,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            
            if (!feed.description.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = feed.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isConfirmDelete) {
                    TextButton(onClick = { isConfirmDelete = false }) {
                        Text("Nein")
                    }
                    Button(
                        onClick = {
                            viewModel.deleteFeed(feed.id)
                            isConfirmDelete = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Ja, Löschen", color = Color.White)
                    }
                } else {
                    TextButton(
                        onClick = { viewModel.refreshFeed(feed.id) },
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Sync")
                    }
                    TextButton(
                        onClick = { isConfirmDelete = true },
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Löschen")
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsTab(
    viewModel: NewsViewModel,
    onLogoutSuccess: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "Erscheinungsbild",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(vertical = 8.dp)
        )

        // Theme preference setting
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Farbschema")
            Row {
                val currentTheme = viewModel.appTheme
                listOf("system" to "Sys", "light" to "Hell", "dark" to "Dunkel").forEach { (themeValue, label) ->
                    val isSelected = currentTheme == themeValue
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.updateTheme(themeValue) },
                        label = { Text(label) },
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )
                }
            }
        }

        // Curated Accent Colors
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Akzentfarbe")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val currentAccent = viewModel.appAccentColor
                listOf(
                    "blue" to Color(0xFF1A73E8),
                    "green" to Color(0xFF2E7D32),
                    "orange" to Color(0xFFE65100),
                    "purple" to Color(0xFF6200EE)
                ).forEach { (colorName, colorHex) ->
                    val isSelected = currentAccent == colorName
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(36.dp)
                            .background(colorHex, CircleShape)
                            .clickable { viewModel.updateAccentColor(colorName) }
                    ) {
                        if (isSelected) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }

        // Layout Density style
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Layout-Stil")
            Row {
                val currentDensity = viewModel.appDensity
                listOf("comfortable" to "Magazin", "compact" to "Kompakt").forEach { (densityValue, label) ->
                    val isSelected = currentDensity == densityValue
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.updateDensity(densityValue) },
                        label = { Text(label) },
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Toggle visibility of images & descriptions
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Bilder anzeigen")
            Switch(
                checked = viewModel.appShowImages,
                onCheckedChange = { viewModel.updateShowImages(it) }
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Beschreibung anzeigen")
            Switch(
                checked = viewModel.appShowDescription,
                onCheckedChange = { viewModel.updateShowDescription(it) }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Konto & Verbindung",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(vertical = 8.dp)
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Server URL", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(viewModel.currentServerUrl, fontWeight = FontWeight.Medium)
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Benutzer", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(viewModel.currentUserName, fontWeight = FontWeight.Medium)
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = { viewModel.markAllArticlesRead() },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
        ) {
            Icon(Icons.Default.MarkEmailRead, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Alle Artikel als gelesen markieren")
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = {
                viewModel.logout(onSuccess = onLogoutSuccess)
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
        ) {
            Icon(Icons.Default.ExitToApp, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Abmelden")
        }
    }
}

fun formatDate(pubDateString: String?): String {
    if (pubDateString.isNullOrEmpty()) return ""
    try {
        // Try parsing common ISO formats
        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "EEE, dd MMM yyyy HH:mm:ss z"
        )
        var date: Date? = null
        for (format in formats) {
            try {
                val parser = SimpleDateFormat(format, Locale.US)
                if (format.endsWith("'Z'")) {
                    parser.timeZone = TimeZone.getTimeZone("UTC")
                }
                date = parser.parse(pubDateString)
                if (date != null) break
            } catch (e: Exception) {
                // Ignore and try next format
            }
        }
        if (date != null) {
            val formatter = SimpleDateFormat("dd. MMM yyyy, HH:mm", Locale.getDefault())
            return formatter.format(date)
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
    return pubDateString
}

// Simple horizontal scroll helper for settings screen
@Composable
fun rememberScrollState(): androidx.compose.foundation.ScrollState {
    return androidx.compose.foundation.rememberScrollState()
}

fun String.stripHtml(): String {
    return this.replace(Regex("<[^>]*>"), "")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .trim()
}
