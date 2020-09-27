import { render } from '@redwoodjs/testing'

import ChangelogLayout from './ChangelogLayout'

describe('ChangelogLayout', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<ChangelogLayout />)
    }).not.toThrow()
  })
})
