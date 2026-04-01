import { z } from 'zod'

export const DemoRequestSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  workEmail: z.string().email('Valid work email is required'),
  companyName: z.string().min(1, 'Company name is required').max(100),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
  message: z.string().max(1000).optional(),
})

export type DemoRequestInput = z.infer<typeof DemoRequestSchema>
