import React from 'react'
import { render } from '@testing-library/react-native'
import { NpsSparkline } from '../components/NpsSparkline'

describe('NpsSparkline', () => {
  it('renders without crashing with valid data', () => {
    const { toJSON } = render(<NpsSparkline data={[55, 58, 61, 59, 62, 60, 62]} />)
    expect(toJSON()).toBeTruthy()
  })

  it('renders nothing with fewer than 2 data points', () => {
    const { toJSON } = render(<NpsSparkline data={[62]} />)
    expect(toJSON()).toBeNull()
  })

  it('renders nothing with empty array', () => {
    const { toJSON } = render(<NpsSparkline data={[]} />)
    expect(toJSON()).toBeNull()
  })
})
