import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define quais rotas são públicas
const isPublicRoute = createRouteMatcher([
  '/', 
  '/opt-out', 
  '/api/webhooks(.*)', 
  '/api/disparo', 
  '/api/teste' // Adicione suas outras rotas de API aqui
]);

export default clerkMiddleware(async (auth, request) => {
  // Se a rota for pública, o Clerk ignora a autenticação
  if (isPublicRoute(request)) {
    return;
  }
  
  // Para qualquer outra rota, protege a aplicação
  await auth.protect();
});

export const config = {
  matcher: [
    // Ignora arquivos estáticos (imagens, css, etc)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Sempre roda o middleware para rotas de API e trpc
    '/(api|trpc)(.*)',
  ],
};