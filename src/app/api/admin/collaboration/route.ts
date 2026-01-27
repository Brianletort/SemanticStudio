/**
 * Admin Collaboration API
 * 
 * Cross-user intelligence for detecting collaboration opportunities.
 * Use cases:
 * - Two sellers working on the same customer
 * - Multiple users discussing same entity
 * - Identifying hot topics across the organization
 * 
 * SECURITY: This endpoint should be restricted to admin users only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ContextGraphService } from '@/lib/memory/context-graph-service';

// In production, this would check actual admin authentication
function isAdminUser(request: NextRequest): boolean {
  const adminHeader = request.headers.get('x-admin-key');
  const userRole = request.headers.get('x-user-role');
  
  // For development, allow access with admin header or role
  // In production, implement proper authentication
  return adminHeader === process.env.ADMIN_API_KEY || userRole === 'admin';
}

/**
 * GET /api/admin/collaboration
 * 
 * Query params:
 * - action: 'shared-entities' | 'entity-users' | 'entity-details' | 'opportunities'
 * - entityId: For entity-specific queries
 * - userId: For user-specific queries (opportunities)
 * - minUsers: Minimum user count for shared entities (default: 2)
 */
export async function GET(request: NextRequest) {
  // Check admin access
  if (!isAdminUser(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'shared-entities';
  const entityId = searchParams.get('entityId');
  const userId = searchParams.get('userId');
  const minUsers = parseInt(searchParams.get('minUsers') || '2', 10);

  try {
    switch (action) {
      case 'shared-entities': {
        // Get entities discussed by multiple users
        const sharedEntities = await ContextGraphService.getSharedEntities(minUsers);
        
        return NextResponse.json({
          success: true,
          action: 'shared-entities',
          minUsers,
          count: sharedEntities.length,
          entities: sharedEntities,
        });
      }

      case 'entity-users': {
        // Get all users who discussed a specific entity
        if (!entityId) {
          return NextResponse.json(
            { error: 'entityId is required for entity-users action' },
            { status: 400 }
          );
        }

        const users = await ContextGraphService.getUsersDiscussingEntity(entityId);
        
        return NextResponse.json({
          success: true,
          action: 'entity-users',
          entityId,
          userCount: users.length,
          users,
        });
      }

      case 'entity-details': {
        // Get detailed discussion info for an entity
        if (!entityId) {
          return NextResponse.json(
            { error: 'entityId is required for entity-details action' },
            { status: 400 }
          );
        }

        const includeUsers = searchParams.get('includeUsers') === 'true';
        const details = await ContextGraphService.getEntityDiscussionDetails(
          entityId,
          includeUsers
        );
        
        return NextResponse.json({
          success: true,
          action: 'entity-details',
          ...details,
        });
      }

      case 'opportunities': {
        // Get collaboration opportunities for a specific user
        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required for opportunities action' },
            { status: 400 }
          );
        }

        const opportunities = await ContextGraphService.getCollaborationOpportunities(
          userId
        );
        
        return NextResponse.json({
          success: true,
          action: 'opportunities',
          userId,
          count: opportunities.length,
          opportunities,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[CollaborationAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/collaboration/notify
 * 
 * Send collaboration notification to users discussing same entity
 * (Future implementation)
 */
export async function POST(request: NextRequest) {
  // Check admin access
  if (!isAdminUser(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 403 }
    );
  }

  // Placeholder for notification functionality
  return NextResponse.json({
    success: false,
    error: 'Notification feature not yet implemented',
  });
}
