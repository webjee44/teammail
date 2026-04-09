

## Plan : Auto-scroll en bas à l'ouverture d'une conversation

### Problème
Quand on ouvre une conversation (email ou WhatsApp), la liste de messages s'affiche depuis le haut — il faut scroller manuellement pour voir les derniers messages.

### Solution
Ajouter un `useRef` + `useEffect` dans `MessageList.tsx` pour scroller automatiquement en bas de la liste à chaque changement de conversation.

### Étapes

1. **`src/components/inbox/conversation/MessageList.tsx`**
   - Ajouter `useRef` pour un élément sentinelle en bas de la liste
   - Ajouter un `useEffect` qui déclenche `scrollIntoView` quand les messages changent (nouvel ID de conversation)
   - Placer un `<div ref={bottomRef} />` juste avant la fermeture du `</ScrollArea>`

### Détail technique
```tsx
const bottomRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  // Petit délai pour laisser le DOM se rendre
  setTimeout(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, 50);
}, [messages]);
```

Le `behavior: "instant"` évite une animation lente au chargement. Le WhatsApp (`WhatsAppConversationDetail.tsx`) a déjà ce comportement — seule la vue email est concernée.

