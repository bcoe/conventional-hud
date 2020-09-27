import { render } from '@redwoodjs/testing'

import ChangelogPage from './ChangelogPage'

describe('ChangelogPage', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<ChangelogPage />)
    }).not.toThrow()
  })
})
