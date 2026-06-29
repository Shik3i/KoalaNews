<script lang="ts">
  import AuthForm from '$lib/components/AuthForm.svelte';
</script>

<svelte:head>
  <title>Sign in | KoalaNews</title>
  <meta name="description" content="Sign in to your KoalaNews account." />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<AuthForm mode="login" />
