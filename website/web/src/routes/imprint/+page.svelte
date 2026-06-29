<script lang="ts">
  import { locale } from '$lib/i18n';
  import { GITHUB_ISSUES_URL, CONTACT_EMAIL, imprint, legalLocale } from '$lib/legal';

  const lang = $derived(legalLocale($locale));
  const page = $derived(imprint[lang]);
</script>

<svelte:head>
  <title>{page.title} | KoalaNews</title>
  <meta name="description" content="KoalaNews imprint and legal notice." />
</svelte:head>

<article class="legal-page surface">
  <a class="legal-back link-accent" href="/">{lang === 'de' ? 'Zurueck zu KoalaNews' : 'Back to KoalaNews'}</a>
  <header class="legal-header">
    <p class="legal-eyebrow">{page.eyebrow}</p>
    <h1>{page.title}</h1>
    <p class="text-muted">{page.updated}</p>
  </header>

  {#each page.sections as section}
    <section class="legal-section">
      <h2>{section.heading}</h2>
      {#each section.paragraphs as paragraph}
        <p>{paragraph}</p>
      {/each}
    </section>
  {/each}

  <section class="legal-section">
    <h2>{lang === 'de' ? 'Kontaktlinks' : 'Contact links'}</h2>
    <p>
      Email:
      <a class="link-accent" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </p>
    <p>
      GitHub Issues:
      <a class="link-accent" href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">Shik3i/KoalaNews</a>
    </p>
  </section>
</article>
