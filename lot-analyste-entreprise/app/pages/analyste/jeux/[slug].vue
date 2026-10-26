<script setup lang="ts">
const route = useRoute()
await navigateTo(`/jeu?game=${encodeURIComponent(String(route.params.slug ?? ''))}`, { redirectCode: 302 })
</script>
