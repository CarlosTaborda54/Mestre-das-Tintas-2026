MESTRE DAS TINTAS — COMO ABRIR

1. Extraia o ZIP inteiro para uma pasta normal do Windows.
2. Execute 00_CLIQUE_AQUI.bat (ou ABRIR_MESTRE_DAS_TINTAS.bat).
3. O script instala as dependências, se necessário, e abre o aplicativo em Electron.
4. Dentro do aplicativo, use Importar Excel > Escolher Excel.

IMPORTANTE
- NÃO abra app\index.html diretamente no Microsoft Edge/Chrome para usar a versão completa.
- Quando o index.html é aberto como file://, o Electron/preload não existe. Isso provoca mensagens de segurança de origem e impede a persistência nativa.
- A importação Excel da versão Electron usa a biblioteca xlsx local do projeto e não depende de CDN.
- A versão aberta diretamente no navegador possui apenas um modo de compatibilidade e pode precisar de Internet para carregar o leitor Excel.

IMPORTAÇÃO
- O leitor agora procura automaticamente a linha real de cabeçalho, mesmo quando existem títulos/linhas vazias antes dela.
- Suporta .xlsx, .xls, .xlsm, .xlsb e .csv.
- Reconhece abas de fornecedores, produtos, clientes e orçamento por nome da aba e por cabeçalhos.
- Fornecedores são criados/atualizados nas fichas de fornecedores.
- Produtos/itens são criados/atualizados na base mestre e, quando aplicável, no orçamento do cliente.
- Clientes encontrados na planilha são criados/atualizados e recebem seus itens no orçamento individual.
- Dados de CNPJ, telefone, WhatsApp, e-mail, endereço, categoria, quantidade, preço, IPI, ICMS, frete, condição e observações são aproveitados quando presentes.
- O botão “Importar dados” só é desabilitado quando nenhuma linha foi reconhecida; linhas não reconhecidas são informadas na prévia.

CORREÇÕES DESTA VERSÃO
- Corrigido o botão “Importar dados” e o fluxo de gravação.
- Corrigida a ausência do elemento de toast.
- Corrigida a leitura CSV de quebra de linha (\n/\r) e suporte a tabulação.
- Removida a referência ao manifest que gerava CORS ao abrir file://.
- Melhorado o mapeamento de cabeçalhos e a detecção automática da linha de cabeçalho.
- O Electron continua usando preload/contextIsolation e grava o estado no arquivo local da aplicação.
