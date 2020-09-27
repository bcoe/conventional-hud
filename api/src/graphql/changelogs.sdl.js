export const schema = gql`
  type Changelog {
    id: Int!
    shas: String!
    content: String
  }

  type Query {
    changelogs: [Changelog!]!
  }

  input CreateChangelogInput {
    shas: String!
    content: String
  }

  input UpdateChangelogInput {
    shas: String
    content: String
  }

  type Mutation {
    createChangelog(input: CreateChangelogInput!): Changelog
  }
`
