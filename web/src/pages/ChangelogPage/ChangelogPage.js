import {
  Form,
  TextAreaField,
  TextField,
  Submit,
  FieldError,
} from '@redwoodjs/forms'
import { useMutation } from '@redwoodjs/web'
import ChangelogLayout from 'src/layouts/ChangelogLayout'

const CREATE_CHANGELOG = gql`
  mutation CreateChangelogMutation($input: CreateChangelogInput!) {
    createChangelog(input: $input) {
      shas
      content
    }
  }
`

const ChangelogPage = () => {
  const [create] = useMutation(CREATE_CHANGELOG)

  const onSubmit = async (data) => {
    const result = await create({ variables: { input: data }})
    console.info(result)
  }

  return (
    <ChangelogLayout>
      <Form onSubmit={onSubmit} className="w-full">
        <div className="flex flex-wrap -mx-3 mb-6">
          <div className="w-full md:w-1/2 px-3 mb-6 md:mb-0">
            <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" for="repository">
              Repository
            </label>
            <TextField className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white" id="repository" type="text" placeholder="googleapis/nodejs-storage" />
          </div>
          <div className="w-full md:w-1/2 px-3">
            <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" for="grid-last-name">
              Commits Since
            </label>
            <TextAreaField className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 leading-tight focus:outline-none focus:bg-white focus:border-gray-500" id="grid-last-name" type="text" placeholder="SHAs, tag, or ref" />
          </div>
        </div>
        <div className="flex flex-wrap -mx-3 mb-6">
          <div className="w-full px-3">
            <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" for="changelog-markdown">
              Changelog Markdown
            </label>
            <TextAreaField className="appearance-none block w-full bg-gray-200 text-gray-700 border border-gray-200 rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white focus:border-gray-500 h-64" id="changelog-markdown" readOnly />
          </div>
        </div>
      </Form>
    </ChangelogLayout>
  )
}

export default ChangelogPage