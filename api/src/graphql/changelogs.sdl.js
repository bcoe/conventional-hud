export const schema = gql`
  type Changelog {
    id: Int!
    branch: String
    shas: String!
    repository: String
    markdown: String
    html: String
  }

  type Query {
    changelogs: [Changelog!]!
  }

  input CreateChangelogInput {
    shas: String!
    branch: String
    repository: String
    markdown: String
    html: String
  }

  input UpdateChangelogInput {
    shas: String
    branch: String
    repository: String
    markdown: String
    html: String
  }

  type Mutation {
    createChangelog(input: CreateChangelogInput!): Changelog
  }
`
