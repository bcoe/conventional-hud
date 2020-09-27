export const changelogs = () => {
  return [];
}

export const createChangelog = async ({ input }) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      return resolve({id: 1, content: `my awesome changelog`, shas: input.shas})
    }, 1000)
  })
}
